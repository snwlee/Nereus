import { describe, it, expect } from "vitest";
import { loadLocales, localeIds, expansionOf } from "../../plugins/nereus-game/lib/locales.mjs";

describe("locales", () => {
  it("로블록스 상위 시장 8종을 데이터로 선언한다", () => {
    const ids = localeIds(loadLocales());
    expect(ids).toEqual(expect.arrayContaining(["en", "ko", "ja", "pt-BR", "es", "zh", "fr", "de"]));
  });
  it("기준 로케일이 목록 안에 있다", () => {
    const d = loadLocales();
    expect(localeIds(d)).toContain(d.base);
  });
  it("독일어는 영어보다 길어지고 일본어는 짧아진다", () => {
    const d = loadLocales();
    expect(expansionOf(d, "de")).toBeGreaterThan(1);
    expect(expansionOf(d, "ja")).toBeLessThan(1);
  });
  it("알 수 없는 로케일은 기본값으로 떨어지지 않고 던진다", () => {
    expect(() => expansionOf(loadLocales(), "kl")).toThrow(/알 수 없는 로케일/);
  });
});
