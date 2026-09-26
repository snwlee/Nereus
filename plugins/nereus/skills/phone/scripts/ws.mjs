// 표준 라이브러리만으로 받는 WebSocket 서버(RFC 6455). Twilio Media Streams 가 붙는 쪽에만 쓴다.
// 플러그인 런타임은 npm 을 쓰지 않는다 — 기존 aicall 의 `ws` 의존을 이걸로 대신한다.
// 클라이언트 쪽(OpenAI Realtime)은 Node 내장 WebSocket 을 쓴다.
//
// 범위: 텍스트·바이너리·ping·pong·close, 조각(continuation) 합치기. 확장(permessage-deflate)은 협상하지 않는다.
// 크기 상한(보안 리뷰 2026-09-26 M5·M6): Twilio μ-law 프레임은 수백 바이트다. 길이 필드를 믿고 버퍼를 키우면
// 비밀 경로를 아는 클라이언트 하나가 메모리를 다 쓸 수 있다 — 프레임·메시지 상한을 넘으면 연결을 끊는다.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OP = Object.freeze({ cont: 0, text: 1, binary: 2, close: 8, ping: 9, pong: 10 });
const TYPE = Object.freeze({ 1: "text", 2: "binary", 8: "close", 9: "ping", 10: "pong" });

export const MAX_FRAME = 32 * 1024;
export const MAX_MESSAGE = 256 * 1024;

export class WsError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.code = code; }
}
const fail = (code, detail) => { throw new WsError(code, detail); };

export function acceptKey(key) {
  return crypto.createHash("sha1").update(String(key) + GUID).digest("base64");
}

export function encodeFrame(data, opcode = OP.text) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, payload]);
}

// 한 프레임을 읽는다. 모자라면 null. 서버가 받는 프레임이므로 마스크가 필수다(RFC 6455 §5.1).
function readFrame(buf) {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const opcode = buf[0] & 0x0f;
  if (buf[0] & 0x70) fail("protocol", "RSV 비트");
  if (!(opcode in TYPE) && opcode !== OP.cont) fail("protocol", `예약 opcode ${opcode}`);
  if (!(buf[1] & 0x80)) fail("unmasked", "클라이언트 프레임에 마스크가 없다");
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    const big = buf.readBigUInt64BE(2);
    if (big > BigInt(MAX_FRAME)) fail("too-big", `프레임 ${big}`);
    len = Number(big); off = 10;
  }
  if (len > MAX_FRAME) fail("too-big", `프레임 ${len}`);
  if (opcode >= OP.close && (len > 125 || !fin)) fail("protocol", "제어 프레임은 125바이트 이하·조각 불가");
  if (buf.length < off + 4 + len) return null;
  const mask = buf.subarray(off, off + 4);
  const raw = buf.subarray(off + 4, off + 4 + len);
  const payload = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) payload[i] = raw[i] ^ mask[i & 3];
  return { fin, opcode, payload, size: off + 4 + len };
}

export class FrameDecoder {
  #buf = Buffer.alloc(0);
  #frag = null;   // { opcode, parts, bytes }

  push(chunk) {
    this.#buf = Buffer.concat([this.#buf, chunk]);
    const out = [];
    for (let f = readFrame(this.#buf); f; f = readFrame(this.#buf)) {
      this.#buf = this.#buf.subarray(f.size);
      const msg = this.#assemble(f);
      if (msg) out.push(msg);
    }
    return out;
  }

  #assemble({ fin, opcode, payload }) {
    if (opcode >= OP.close) return { type: TYPE[opcode], data: payload };   // 제어 프레임은 조각나지 않는다
    if (opcode === OP.cont && !this.#frag) fail("protocol", "시작 없는 continuation");
    if (opcode !== OP.cont && this.#frag) fail("protocol", "조각 메시지가 끝나기 전에 새 데이터 프레임");
    if (opcode !== OP.cont) this.#frag = { opcode, parts: [], bytes: 0 };
    this.#frag.bytes += payload.length;
    if (this.#frag.bytes > MAX_MESSAGE) fail("too-big", `메시지 ${this.#frag.bytes}`);
    this.#frag.parts.push(payload);
    if (!fin) return null;
    const { opcode: op, parts } = this.#frag;
    this.#frag = null;
    const data = Buffer.concat(parts);
    return op === OP.text ? { type: "text", data: data.toString("utf8") } : { type: "binary", data };
  }
}

// http 'upgrade' 이벤트의 (req, socket, head) 를 받아 연결을 연다. 이벤트: message(text), close().
export function upgrade(req, socket, head = Buffer.alloc(0)) {
  const key = req.headers["sec-websocket-key"];
  const conn = new EventEmitter();
  if (!key) { socket.destroy(); return conn; }
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    "", "",
  ].join("\r\n"));

  const decoder = new FrameDecoder();
  let closed = false;
  const finish = () => { if (closed) return; closed = true; conn.emit("close"); };
  const write = (frame) => { if (!socket.destroyed && socket.writable) socket.write(frame); };

  conn.send = (text) => write(encodeFrame(text));
  conn.close = () => { write(encodeFrame(Buffer.alloc(0), OP.close)); socket.end(); finish(); };
  Object.defineProperty(conn, "open", { get: () => !closed && !socket.destroyed });

  const onData = (chunk) => {
    let msgs;
    try { msgs = decoder.push(chunk); } catch (e) {
      conn.emit("protocol-error", e);
      const code = e.code === "too-big" ? 1009 : 1002;
      write(encodeFrame(Buffer.from([code >> 8, code & 0xff]), OP.close));
      socket.destroy();
      finish();
      return;
    }
    for (const m of msgs) {
      if (m.type === "text") conn.emit("message", m.data);
      else if (m.type === "ping") write(encodeFrame(m.data, OP.pong));
      else if (m.type === "close") { conn.close(); return; }
    }
  };
  socket.on("data", onData);
  socket.on("close", finish);
  socket.on("error", finish);
  if (head.length) onData(head);
  return conn;
}
