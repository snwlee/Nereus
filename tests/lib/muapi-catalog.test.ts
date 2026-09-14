import { describe, it, expect } from "vitest";
import { loadMuapiCatalog, pickModels } from "../../plugins/nereus/skills/image/scripts/muapi-catalog.mjs";

describe("Muapi 모델 카탈로그", () => {
  it("능력별로 모델이 있다", () => {
    const c = loadMuapiCatalog();
    for (const cap of ["t2i", "i2i", "t2v", "i2v", "lipsync", "audio"]) {
      expect(c.models[cap]?.length, cap).toBeGreaterThan(0);
    }
  });
  it("모든 모델이 호출 가능한 endpoint 를 갖는다 — 없으면 부를 수 없다", () => {
    const c = loadMuapiCatalog();
    for (const [cap, list] of Object.entries(c.models)) {
      for (const m of list as any[]) expect(m.endpoint, `${cap}/${m.id}`).toBeTruthy();
    }
  });
  it("출처·라이선스·확인일·호출 모양이 데이터에 있다", () => {
    const c = loadMuapiCatalog();
    expect(c.source).toMatch(/^https:\/\//);
    expect(c.sourceLicense).toBe("MIT");
    expect(c.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.callShape).toMatch(/x-api-key/);
  });
  it("가격·쿼터를 데이터에 넣지 않는다 — 운영값이다", () => {
    const raw = JSON.stringify(loadMuapiCatalog());
    expect(raw).not.toMatch(/"price"|"cost"|"quota"|"credits"/);
  });
  it("능력으로 모델을 고른다 — 스킬이 이름을 외우지 않는다", () => {
    const v = pickModels("t2v");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0]).toHaveProperty("endpoint");
  });
  it("모르는 능력은 사유 있는 오류다", () => {
    expect(() => pickModels("nope")).toThrow(/능력/);
  });
});
