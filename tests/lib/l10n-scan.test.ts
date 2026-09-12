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
});
