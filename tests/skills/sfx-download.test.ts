import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadTo } from "../../plugins/nereus/skills/sfx/scripts/download.mjs";

const body = (chunks: Uint8Array[]) => new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(x)); c.close(); } });
const res = (over: Record<string, unknown> = {}) => ({ ok: true, status: 200, url: "https://cdn.example.org/a.mp3", headers: new Headers(), body: body([new Uint8Array([1, 2, 3])]), ...over });
const dest = () => join(mkdtempSync(join(tmpdir(), "sfxdl-")), "a.mp3");

describe("sfx.download", () => {
  it("스트리밍으로 받아 쓴다", async () => {
    const d = dest();
    await downloadTo("https://cdn.example.org/a.mp3", d, { fetchImpl: async () => res() });
    expect([...readFileSync(d)]).toEqual([1, 2, 3]);
  });
  it("content-length 가 상한을 넘으면 읽기 전에 거부", async () => {
    const d = dest();
    await expect(downloadTo("https://x.org/a.mp3", d, { maxBytes: 2, fetchImpl: async () => res({ headers: new Headers({ "content-length": "999" }) }) })).rejects.toThrow(/too large/);
    expect(existsSync(d)).toBe(false);
  });
  it("길이 헤더 없이 상한을 넘으면 중단하고 파일을 남기지 않는다", async () => {
    const d = dest();
    const big = res({ body: body([new Uint8Array(2), new Uint8Array(2)]) });
    await expect(downloadTo("https://x.org/a.mp3", d, { maxBytes: 3, fetchImpl: async () => big })).rejects.toThrow(/too large/);
    expect(existsSync(d)).toBe(false);
  });
  it("리다이렉트를 따라가되 매 단계 https·공개 주소를 검사한다", async () => {
    const hop = (location: string) => res({ ok: false, status: 302, headers: new Headers({ location }), body: null });
    const seq = (...r: unknown[]) => { let i = 0; return async () => r[i++]; };
    const d = dest();
    await downloadTo("https://x.org/a.mp3", d, { fetchImpl: seq(hop("https://cdn.x.org/b.mp3"), res()) });
    expect([...readFileSync(d)]).toEqual([1, 2, 3]);
    await expect(downloadTo("https://x.org/a.mp3", dest(), { fetchImpl: seq(hop("http://x.org/a.mp3")) })).rejects.toThrow(/https/);
    await expect(downloadTo("https://x.org/a.mp3", dest(), { fetchImpl: seq(hop("https://169.254.169.254/latest")) })).rejects.toThrow(/private/);
  });
  it("리다이렉트는 5 번까지", async () => {
    const loop = async () => res({ ok: false, status: 301, headers: new Headers({ location: "https://x.org/again" }), body: null });
    await expect(downloadTo("https://x.org/a.mp3", dest(), { fetchImpl: loop })).rejects.toThrow(/redirects/);
  });
  it("시작 url 도 검사한다", async () => {
    await expect(downloadTo("https://127.0.0.1/a.mp3", dest(), { fetchImpl: async () => res() })).rejects.toThrow(/private/);
  });
  it("http 오류는 상태를 담아 낸다", async () => {
    await expect(downloadTo("https://x.org/a.mp3", dest(), { fetchImpl: async () => res({ ok: false, status: 404 }) })).rejects.toThrow(/404/);
  });
});
