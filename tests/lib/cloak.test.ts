import { describe, it, expect } from "vitest";
import { FREE_PIN, cloakPlan, exportLine } from "../../plugins/nereus/skills/research/scripts/cloak.mjs";

describe("cloakPlan — 무료 고정", () => {
  it("고정이 없으면 최신(=Pro)을 받는다. 위반이다", () => {
    const p = cloakPlan({});
    expect(p.tier).toBe("unpinned");
    expect(p.ok).toBe(false);
    expect(p.violations.map((v: any) => v.code)).toContain("unpinned");
  });

  it("무료 핀이면 통과한다", () => {
    const p = cloakPlan({ CLOAKBROWSER_VERSION: FREE_PIN });
    expect(p).toMatchObject({ tier: "free", ok: true, major: 146 });
    expect(p.violations).toEqual([]);
  });

  it("146 이하면 무료다", () => {
    expect(cloakPlan({ CLOAKBROWSER_VERSION: "145.0.1.2.3" }).tier).toBe("free");
  });

  it("148 이상이면 Pro 다 — 구독 없이는 받지도 못한다", () => {
    const p = cloakPlan({ CLOAKBROWSER_VERSION: "148.0.7778.215.5" });
    expect(p.tier).toBe("pro");
    expect(p.ok).toBe(false);
    expect(p.violations.map((v: any) => v.code)).toContain("pro-version");
  });

  it("라이선스 키가 있으면 무료 핀이어도 알린다 — 유료 경로가 열려 있다", () => {
    const p = cloakPlan({ CLOAKBROWSER_VERSION: FREE_PIN, CLOAKBROWSER_LICENSE_KEY: "cb_x" });
    expect(p.ok).toBe(false);
    expect(p.violations.map((v: any) => v.code)).toContain("license-key-set");
  });

  it("읽을 수 없는 핀은 무료로 단정하지 않는다", () => {
    const p = cloakPlan({ CLOAKBROWSER_VERSION: "최신" });
    expect(p.tier).toBe("unknown");
    expect(p.ok).toBe(false);
    expect(p.violations.map((v: any) => v.code)).toContain("unparsable");
  });

  it("고정 명령은 무료 핀을 그대로 쓴다", () => {
    expect(exportLine()).toBe(`export CLOAKBROWSER_VERSION=${FREE_PIN}`);
    expect(FREE_PIN.startsWith("146.")).toBe(true);
  });
});
