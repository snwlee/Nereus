import { describe, it, expect } from "vitest";
import { loadPolicy, surfacesFor } from "../../plugins/nereus-game/lib/policy.mjs";

describe("policy", () => {
  it("정책마다 출처와 확인일이 붙어 있다 — 남이 정한 값이라 언제 확인했는지가 중요하다", () => {
    const p = loadPolicy();
    expect(p.source).toMatch(/^https:\/\//);
    expect(p.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("출처 없는 정책은 거부한다 — 다음 사람이 검증할 수 없다", () => {
    const deps = { readJson: () => ({ paidRandom: { baseSurfaces: ["game"] } }) };
    expect(() => loadPolicy(deps)).toThrow(/출처|checkedAt|source/);
  });
  it("기본 공개 표면은 게임 안이다", () => {
    expect(surfacesFor(loadPolicy(), [])).toEqual(["game"]);
  });
  it("한국 시장은 게임·웹사이트·광고 세 곳을 요구한다", () => {
    const s = surfacesFor(loadPolicy(), ["KR"]);
    expect(s).toEqual(expect.arrayContaining(["game", "website", "ad"]));
  });
  it("모르는 시장은 기본 표면만 요구한다 — 없는 규제를 지어내지 않는다", () => {
    expect(surfacesFor(loadPolicy(), ["ZZ"])).toEqual(["game"]);
  });
  it("한국 규제에 법령명과 시행일이 붙어 있다", () => {
    const kr = loadPolicy().paidRandom.markets.KR;
    expect(kr.law).toBeTruthy();
    expect(kr.effective).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
