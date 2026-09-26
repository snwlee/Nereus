import { describe, it, expect } from "vitest";
import http from "node:http";
import { acceptKey, encodeFrame, FrameDecoder, upgrade } from "../../plugins/nereus/skills/phone/scripts/ws.mjs";

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
