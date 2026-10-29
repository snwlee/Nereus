import { describe, it, expect } from "vitest";
import { buildSearchUrl, parseResults, search } from "../../plugins/nereus/skills/sfx/scripts/openverse.mjs";

const cc0 = { id: "a", title: "Deep Whoosh #1", url: "https://cdn.freesound.org/x.mp3", license: "cc0", license_version: "1.0",
  attribution: "\"Deep Whoosh #1\" by Kinoton is marked with CC0 1.0.", duration: 3155, source: "freesound", filetype: "mp3" };
const nc = { ...cc0, id: "b", license: "by-nc" };

describe("sfx.openverse", () => {
  it("category 를 싣지 않는다", () => {
    const u = new URL(buildSearchUrl({ q: "whoosh" }));
    expect(u.origin + u.pathname).toBe("https://api.openverse.org/v1/audio/");
    expect(u.searchParams.get("q")).toBe("whoosh");
    expect(u.searchParams.get("license")).toBe("cc0,pdm");
    expect(u.searchParams.get("page_size")).toBe("10");
    expect(u.searchParams.has("category")).toBe(false);
  });
  it("page_size 상한", () => {
    expect(new URL(buildSearchUrl({ q: "pop", pageSize: 50 })).searchParams.get("page_size")).toBe("20");
  });
  it("정규화와 차단 항목 제거", () => {
    const r = parseResults({ results: [nc, cc0, { ...cc0, id: "c", url: null }] });
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ id: "a", title: "Deep Whoosh #1", url: cc0.url, license: "cc0", attribution: cc0.attribution, durationSec: 3.155, source: "freesound", filetype: "mp3" });
  });
  it("search 는 fetch 실패를 에러로 낸다", async () => {
    const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(search("x", { fetchImpl })).rejects.toThrow(/429/);
  });
  it("search 는 정규화 결과를 돌려준다", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ results: [cc0] }) });
    expect((await search("x", { fetchImpl }))[0].id).toBe("a");
  });
  it("5xx 는 한 번 재시도한다", async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls === 1 ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ results: [cc0] }) });
    expect((await search("x", { fetchImpl, retryDelayMs: 0 }))[0].id).toBe("a");
    expect(calls).toBe(2);
  });
  it("4xx 는 재시도하지 않는다", async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls, { ok: false, status: 401, json: async () => ({}) });
    await expect(search("x", { fetchImpl, retryDelayMs: 0 })).rejects.toThrow(/401/);
    expect(calls).toBe(1);
  });
  it("요청마다 타임아웃 signal 을 건다", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = async (_u: string, init: { signal?: AbortSignal }) => ((signal = init.signal), { ok: true, status: 200, json: async () => ({ results: [] }) });
    await search("x", { fetchImpl });
    expect(signal).toBeInstanceOf(AbortSignal);
  });
  it("JSON 이 아닌 200 응답은 원인을 담아 낸다", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } });
    await expect(search("x", { fetchImpl })).rejects.toThrow(/openverse: invalid JSON/);
  });
});
