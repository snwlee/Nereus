import { describe, it, expect } from "vitest";
import http from "node:http";
import { acceptKey, encodeFrame, FrameDecoder, upgrade, MAX_FRAME, MAX_MESSAGE, WsError } from "../../plugins/nereus/skills/phone/scripts/ws.mjs";

const MASK = Buffer.from([1, 2, 3, 4]);
const maskedFrame = (payload: Buffer, opcode = 1, fin = true) => {
  const len = payload.length;
  const head = len < 126 ? Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | len])
    : Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | 126, len >> 8, len & 0xff]);
  return Buffer.concat([head, MASK, Buffer.from(payload.map((b, i) => b ^ MASK[i % 4]))]);
};
const masked = (text: string) => maskedFrame(Buffer.from(text));

describe("phone.ws codec", () => {
  it("RFC 예제 키", () => expect(acceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo="));

  it("두 조각 프레임", () => {
    const d = new FrameDecoder(), f = masked("hello");
    expect(d.push(f.subarray(0, 3))).toEqual([]);
    expect(d.push(f.subarray(3))).toEqual([{ type: "text", data: "hello" }]);
  });

  it("길이 경계 125·126·65536", () => {
    expect(encodeFrame("x".repeat(125)).subarray(0, 2)).toEqual(Buffer.from([0x81, 125]));
    expect(encodeFrame("x".repeat(200)).subarray(0, 4)).toEqual(Buffer.from([0x81, 126, 0, 200]));
    const big = encodeFrame("x".repeat(65536));
    expect(big[1]).toBe(127);
    expect(big.readBigUInt64BE(2)).toBe(65536n);
    expect(big.length).toBe(10 + 65536);
  });

  it("126 길이 마스크 프레임과 한 버퍼에 두 프레임", () => {
    const d = new FrameDecoder();
    const long = "y".repeat(300);
    expect(d.push(Buffer.concat([masked(long), masked("b")]))).toEqual([{ type: "text", data: long }, { type: "text", data: "b" }]);
  });

  it("조각난 메시지(continuation)를 합친다", () => {
    const d = new FrameDecoder();
    const out = d.push(Buffer.concat([maskedFrame(Buffer.from("hel"), 1, false), maskedFrame(Buffer.from("lo"), 0, true)]));
    expect(out).toEqual([{ type: "text", data: "hello" }]);
  });

  it("ping·close 를 구분한다", () => {
    const d = new FrameDecoder();
    expect(d.push(maskedFrame(Buffer.from("p"), 9))).toEqual([{ type: "ping", data: Buffer.from("p") }]);
    expect(d.push(maskedFrame(Buffer.alloc(0), 8))).toEqual([{ type: "close", data: Buffer.alloc(0) }]);
  });
});

describe("phone.ws server", () => {
  it("내장 WebSocket 클라이언트와 텍스트 왕복", async () => {
    const server = http.createServer();
    server.on("upgrade", (req, socket) => {
      const conn = upgrade(req, socket);
      conn.on("message", (text: string) => conn.send(`echo:${text}`));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const { port } = server.address() as { port: number };
    const ws = new WebSocket(`ws://127.0.0.1:${port}/x`);
    const reply = await new Promise<string>((resolve, reject) => {
      ws.onopen = () => ws.send("ping-text");
      ws.onmessage = (e) => resolve(String(e.data));
      ws.onerror = () => reject(new Error("ws error"));
    });
    expect(reply).toBe("echo:ping-text");
    const closed = new Promise<void>((r) => { ws.onclose = () => r(); });
    ws.close();
    await closed;
    server.close();
  });

  it("서버가 close 하면 클라이언트 close 이벤트가 온다", async () => {
    const server = http.createServer();
    let serverClosed = false;
    server.on("upgrade", (req, socket) => {
      const conn = upgrade(req, socket);
      conn.on("close", () => { serverClosed = true; });
      conn.on("message", () => conn.close());
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const { port } = server.address() as { port: number };
    const ws = new WebSocket(`ws://127.0.0.1:${port}/x`);
    await new Promise<void>((resolve) => {
      ws.onopen = () => ws.send("bye");
      ws.onclose = () => resolve();
    });
    expect(serverClosed).toBe(true);
    server.close();
  });
});

describe("phone.ws limits (보안 리뷰 M5·M6)", () => {
  const header = (b0: number, lenByte: number, ext: Buffer = Buffer.alloc(0)) => Buffer.concat([Buffer.from([b0, 0x80 | lenByte]), ext, MASK]);
  it("64비트 거대 길이는 거절", () => {
    const ext = Buffer.alloc(8); ext.writeBigUInt64BE(2n ** 40n);
    expect(() => new FrameDecoder().push(header(0x81, 127, ext))).toThrow(/too-big/);
  });
  it("오류는 WsError 로 코드를 싣는다", () => {
    try { new FrameDecoder().push(Buffer.from([0x81, 0x01, 0x61])); } catch (e) {
      expect(e).toBeInstanceOf(WsError);
      expect((e as WsError).code).toBe("unmasked");
    }
  });
  it("MAX_FRAME 초과 16비트 길이도 거절", () => {
    expect(MAX_FRAME).toBeLessThan(65535);
    const ext = Buffer.alloc(2); ext.writeUInt16BE(MAX_FRAME + 1);
    expect(() => new FrameDecoder().push(header(0x81, 126, ext))).toThrow(/too-big/);
  });
  it("마스크 없는 클라이언트 프레임·RSV 비트·예약 opcode 는 거절", () => {
    expect(() => new FrameDecoder().push(Buffer.from([0x81, 0x01, 0x61]))).toThrow(/unmasked/);
    expect(() => new FrameDecoder().push(maskedFrame(Buffer.from("a"), 0x41))).toThrow(/protocol/);
    expect(() => new FrameDecoder().push(maskedFrame(Buffer.from("a"), 3))).toThrow(/protocol/);
  });
  it("제어 프레임 125 초과·조각난 제어 프레임은 거절", () => {
    expect(() => new FrameDecoder().push(maskedFrame(Buffer.alloc(126), 9))).toThrow(/protocol/);
    expect(() => new FrameDecoder().push(maskedFrame(Buffer.from("p"), 9, false))).toThrow(/protocol/);
  });
  it("시작 없는 continuation·열린 조각 중 새 데이터 프레임은 거절", () => {
    expect(() => new FrameDecoder().push(maskedFrame(Buffer.from("x"), 0, true))).toThrow(/protocol/);
    const d = new FrameDecoder();
    d.push(maskedFrame(Buffer.from("a"), 1, false));
    expect(() => d.push(maskedFrame(Buffer.from("b"), 1, true))).toThrow(/protocol/);
  });
  it("조각 합계가 MAX_MESSAGE 를 넘으면 거절", () => {
    const d = new FrameDecoder();
    const chunk = Buffer.alloc(MAX_FRAME, 0x61);
    expect(() => { for (let i = 0; i <= MAX_MESSAGE / MAX_FRAME + 1; i++) d.push(maskedFrame(chunk, i ? 0 : 1, false)); }).toThrow(/too-big/);
  });
  it("프로토콜 위반이면 서버가 소켓을 닫는다", async () => {
    const server = http.createServer();
    server.on("upgrade", (req, socket, head) => { upgrade(req, socket, head); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const { port } = server.address() as { port: number };
    const net = await import("node:net");
    const s = net.connect(port, "127.0.0.1");
    s.resume();   // 읽지 않으면 소켓이 멈춰 FIN 을 못 본다
    await new Promise<void>((r) => s.on("connect", () => r()));
    s.write("GET /x HTTP/1.1\r\nHost: a\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n");
    await new Promise((r) => setTimeout(r, 50));
    s.write(Buffer.from([0x81, 0x01, 0x61]));   // 마스크 없음
    await new Promise<void>((r) => s.on("close", () => r()));
    server.close();
  });
});
