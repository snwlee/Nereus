import { describe, it, expect } from "vitest";
import { loadLocales, localeIds, expansionOf } from "../../plugins/nereus-l10n/lib/locales.mjs";

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

// 스토어 로케일은 **소스 l10n 의 언어 집합과 다른 집합**이다.
// Play 는 `ko-KR`·`en-US` 를 쓰고 소스 문자열 표는 `ko`·`en` 을 쓴다.
// 하나로 뭉치면 한쪽이 반드시 깨진다 — 별칭 항목으로 둘 다 산다.
describe("Play 스토어 로케일", () => {
  const BASES = ["legacy-estimate", "group-estimate", "measured"];
  const playEntries = () =>
    Object.entries(loadLocales().locales).filter(([, v]: any) => (v.stores ?? []).includes("play"));

  it("Play 로케일이 86종이고 각각 코드·라벨·스크립트·방향을 갖는다", () => {
    const play = playEntries();
    expect(play.length).toBe(86);
    for (const [code, v] of play as any) {
      expect(v.label, code).toBeTruthy();
      expect(v.script, code).toBeTruthy();
      expect(["ltr", "rtl"], code).toContain(v.direction);
    }
  });

  it("셈의 근거가 데이터에 있다", () => {
    const d = loadLocales();
    expect(d.source).toMatch(/^https:\/\//);
    expect(d.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.howCounted).toMatch(/86/);
  });

  it("추정값은 근거를 필드마다 갖는다", () => {
    for (const [code, v] of Object.entries(loadLocales().locales) as any) {
      expect(BASES, `${code}.expansionBasis`).toContain(v.expansionBasis);
      expect(BASES, `${code}.avgCharWidthBasis`).toContain(v.avgCharWidthBasis);
    }
  });

  it("전각 스크립트는 확장률이 작아도 자폭이 크다 — 두 축을 섞지 않는다", () => {
    const d = loadLocales();
    expect(d.locales["ko-KR"].expansion).toBeLessThan(1);
    expect(d.locales["ko-KR"].avgCharWidth).toBeGreaterThan(d.locales["en-US"].avgCharWidth);
  });

  it("RTL 로케일이 방향으로 구분된다", () => {
    const rtl = playEntries().filter(([, v]: any) => v.direction === "rtl").map(([c]) => c);
    expect(rtl).toContain("ar");
    expect(rtl).toContain("iw-IL");
    expect(rtl.length).toBeGreaterThanOrEqual(7);
  });

  // 별칭은 편의지 두 번째 출처가 아니다. 값이 갈리면 둘 중 어느 쪽이 진실인지 알 수 없다.
  it("별칭의 수치가 가리키는 로케일과 같다", () => {
    const d = loadLocales();
    const aliases = Object.entries(d.locales).filter(([, v]: any) => v.aliasOf);
    expect(aliases.length).toBeGreaterThan(0);
    for (const [code, v] of aliases as any) {
      const t = d.locales[v.aliasOf];
      expect(t, `${code} 의 aliasOf ${v.aliasOf} 가 없다`).toBeTruthy();
      expect(v.expansion, `${code}.expansion`).toBe(t.expansion);
      expect(v.avgCharWidth, `${code}.avgCharWidth`).toBe(t.avgCharWidth);
      expect(v.stores ?? [], `${code} 는 스토어 로케일이 아니다`).toEqual([]);
    }
  });

  it("스토어 메타에 필드 길이 제한과 코드 형식이 있다", () => {
    const play = loadLocales().stores.play;
    expect(play.source).toMatch(/^https:\/\//);
    expect(play.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(play.fields.title).toBe(30);
    expect(play.fields.shortDescription).toBe(80);
    expect(play.fields.fullDescription).toBe(4000);
  });
});
