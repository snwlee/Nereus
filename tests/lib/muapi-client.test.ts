import { describe, it, expect } from "vitest";
import { buildRequest, resolveModel, requireKey } from "../../plugins/nereus/skills/image/scripts/muapi-client.mjs";

describe("Muapi 클라이언트", () => {
  it("능력만 주면 그 능력의 모델을 고른다", () => {
    const m = resolveModel({ capability: "t2v" });
    expect(m.endpoint).toBeTruthy();
  });
  it("모델 id 를 주면 그것을 쓴다", () => {
    const m = resolveModel({ capability: "t2v", model: "seedance-lite-t2v" });
    expect(m.id).toBe("seedance-lite-t2v");
  });
  it("그 능력에 없는 모델은 사유 있는 오류다", () => {
    expect(() => resolveModel({ capability: "t2v", model: "nano-banana" })).toThrow(/t2v/);
  });
  it("요청 URL 과 헤더가 상류 계약과 같다", () => {
    const r = buildRequest({ endpoint: "seedance-lite-t2v", prompt: "a cat", key: "SECRET" });
    expect(r.url).toBe("https://api.muapi.ai/api/v1/seedance-lite-t2v");
    expect(r.headers["x-api-key"]).toBe("SECRET");
    expect(r.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(r.body).prompt).toBe("a cat");
  });
  it("추가 입력을 본문에 실어 보낸다", () => {
    const r = buildRequest({ endpoint: "x", prompt: "p", key: "k", inputs: { aspect_ratio: "9:16" } });
    expect(JSON.parse(r.body).aspect_ratio).toBe("9:16");
  });
  it("키가 없으면 사유만 내고 값은 절대 출력하지 않는다", () => {
    expect(() => requireKey({})).toThrow(/MUAPI_API_KEY/);
    const err = (() => { try { requireKey({}); } catch (e: any) { return String(e.message); } })();
    expect(err).not.toMatch(/sk-|[A-Za-z0-9]{24,}/);
  });
  it("키가 있으면 그대로 돌려준다", () => {
    expect(requireKey({ MUAPI_API_KEY: "abc" })).toBe("abc");
  });
});
