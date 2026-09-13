import { describe, it, expect } from "vitest";
import { scanL10n } from "../../plugins/nereus-game/lib/l10n-scan.mjs";
import { loadLocales } from "../../plugins/nereus-game/lib/locales.mjs";

const locales = loadLocales();
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("l10n scan", () => {
  it("문자열 테이블을 거치지 않은 사용자 노출 문자열은 hardcoded", () => {
    const sources = [{ file: "src/hud.luau", text: 'label.Text = "Press to jump"\n' }];
    const r = scanL10n({ locales, tables: { en: {} }, sources });
    expect(codes(r)).toContain("hardcoded");
    expect(r.violations[0].file).toBe("src/hud.luau");
    expect(r.violations[0].line).toBe(1);
  });
  it("접근자를 거친 문자열은 걸리지 않는다", () => {
    const sources = [{ file: "src/hud.luau", text: 'label.Text = L("hud.jump")\n' }];
    expect(codes(scanL10n({ locales, tables: { en: {} }, sources }))).not.toContain("hardcoded");
  });
  it("주석 줄은 걸리지 않는다", () => {
    const sources = [{ file: "src/hud.luau", text: '-- label.Text = "Press to jump"\n' }];
    expect(codes(scanL10n({ locales, tables: { en: {} }, sources }))).not.toContain("hardcoded");
  });
  it("기준 로케일의 키가 다른 로케일에 없으면 missing-key", () => {
    const tables = { en: { "hud.jump": "Jump" }, ko: {} };
    const r = scanL10n({ locales, tables });
    expect(codes(r)).toContain("missing-key");
    const v = r.violations.find((x: any) => x.code === "missing-key");
    expect(v.locale).toBe("ko");
    expect(v.key).toBe("hud.jump");
  });
  it("확장률을 곱해 maxWidth 를 넘으면 overflow", () => {
    const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
    const r = scanL10n({ locales, tables, maxWidth: 9 });
    const v = r.violations.find((x: any) => x.code === "overflow");
    expect(v.locale).toBe("de");
    expect(v.key).toBe("hud.jump");
  });
  it("maxWidth 를 주지 않으면 폭 검사를 하지 않는다", () => {
    const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
    expect(codes(scanL10n({ locales, tables }))).not.toContain("overflow");
  });
  it("알 수 없는 로케일이 테이블에 있으면 던진다", () => {
    expect(() => scanL10n({ locales, tables: { en: {}, kl: {} } })).toThrow(/알 수 없는 로케일/);
  });
  // 3차 사이클의 결함: overflow 를 문자 수 × 확장률로 계산해 놓고 근사라고 적지 않았다.
  // 조용한 근사가 근사 없는 것보다 나쁜 이유는 틀린 확신을 주기 때문이다.
  it("폰트 메트릭 없이 낸 폭 판정은 근사임을 표시한다", () => {
    const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
    const v = scanL10n({ locales, tables, maxWidth: 9 }).violations.find((x: any) => x.code === "overflow");
    expect(v.approx).toBe(true);
  });
  it("모든 로케일이 script 와 avgCharWidth 를 갖는다", () => {
    for (const id of Object.keys(locales.locales)) {
      expect(locales.locales[id].script, id).toBeTruthy();
      expect(locales.locales[id].avgCharWidth, id).toBeGreaterThan(0);
    }
  });
  it("전각 스크립트는 라틴보다 자폭이 넓다 — 확장률과는 다른 축이다", () => {
    expect(locales.locales.ko.avgCharWidth).toBeGreaterThan(locales.locales.en.avgCharWidth);
    expect(locales.locales.ko.expansion).toBeLessThan(locales.locales.en.expansion);
  });
  // gemini 리뷰 [MEDIUM]: checkFonts 는 fonts 를 **배열**로, scanL10n 은 **로케일 키 객체**로
  // 받는데 이름이 같았다. 틀리면 조용히 근사로 떨어진다 — 위험한 fallback 이다.
  // 이름을 fontMetrics 로 갈라놓고, 배열이 오면 큰 소리로 막는다.
  it("폰트 메트릭 인자는 fontMetrics 라는 이름이다", () => {
    const tables = { en: { "hud.jump": "Jump now" }, de: { "hud.jump": "Jump now" } };
    const v = scanL10n({ locales, tables, maxWidth: 9, fontMetrics: { de: { avgCharWidth: 2 } } })
      .violations.find((x: any) => x.code === "overflow" && x.locale === "de");
    expect(v.approx).toBe(false);
    expect(v.width).toBe(16);
  });
  it("배열을 넘기면 조용히 근사로 떨어지지 않고 던진다", () => {
    const tables = { en: { "hud.jump": "Jump now" } };
    expect(() => scanL10n({ locales, tables, maxWidth: 9, fontMetrics: [{ avgCharWidth: 2 }] as any }))
      .toThrow(/로케일 키 객체/);
  });
});
