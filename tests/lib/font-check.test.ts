import { describe, it, expect } from "vitest";
import { checkFonts } from "../../plugins/nereus-l10n/lib/font-check.mjs";
import { parseCliInput } from "../../plugins/nereus-l10n/lib/cli-input.mjs";

const profile = { typography: { maxFontKb: 900, minSizePx: 18 } };
const locales = { base: "en", locales: { en: { script: "latin" }, ko: { script: "hangul" } } };
const ok = { name: "GameSans", embedding: ["game", "web"], scripts: ["latin", "hangul"], sizeKb: 400, minSizePx: 18, subset: false };
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("font check", () => {
  it("기준을 전부 만족하면 위반이 없다", () => {
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts: [ok], locales, targetLocales: ["en", "ko"] });
    expect(r.violations).toEqual([]);
    expect(r.unmeasured).toEqual([]);
  });

  it("게임 임베딩이 허용되지 않은 폰트는 license-embedding", () => {
    const fonts = [{ ...ok, embedding: ["web"] }];
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en"] });
    expect(codes(r)).toContain("license-embedding");
    expect(r.violations.find((v: any) => v.code === "license-embedding").font).toBe("GameSans");
  });

  it("임베딩 선언 자체가 없어도 license-embedding — 모름은 허용이 아니다", () => {
    const { embedding, ...noDecl } = ok;
    expect(codes(checkFonts({ requiredEmbedding: "game", profile, fonts: [noDecl], locales, targetLocales: ["en"] }))).toContain("license-embedding");
  });

  it("로케일이 요구하는 스크립트를 아무 폰트도 안 덮으면 script-uncovered", () => {
    const fonts = [{ ...ok, scripts: ["latin"] }];
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en", "ko"] });
    expect(codes(r)).toContain("script-uncovered");
    const v = r.violations.find((x: any) => x.code === "script-uncovered");
    expect(v.locale).toBe("ko");
    expect(v.script).toBe("hangul");
  });

  it("여러 폰트가 나눠 덮으면 커버된 것으로 본다", () => {
    const fonts = [{ ...ok, name: "Latin", scripts: ["latin"] }, { ...ok, name: "Hangul", scripts: ["hangul"] }];
    expect(codes(checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en", "ko"] }))).not.toContain("script-uncovered");
  });

  it("유저 생성 텍스트가 있는데 서브셋하면 subset-unsafe — 닉네임이 두부가 된다", () => {
    const fonts = [{ ...ok, subset: true }];
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en"], userGeneratedText: true });
    expect(codes(r)).toContain("subset-unsafe");
    expect(r.violations.find((v: any) => v.code === "subset-unsafe").font).toBe("GameSans");
  });

  it("유저 생성 텍스트가 없으면 서브셋은 정상이다", () => {
    const fonts = [{ ...ok, subset: true }];
    expect(codes(checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en"], userGeneratedText: false }))).not.toContain("subset-unsafe");
  });

  it("폰트 용량 합이 예산을 넘으면 font-size-budget", () => {
    const fonts = [{ ...ok, name: "A", sizeKb: 500 }, { ...ok, name: "B", sizeKb: 500 }];
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en"] });
    expect(codes(r)).toContain("font-size-budget");
    expect(r.violations.find((v: any) => v.code === "font-size-budget").totalKb).toBe(1000);
  });

  it("최소 표시 크기 미만이면 min-size", () => {
    const fonts = [{ ...ok, minSizePx: 10 }];
    expect(codes(checkFonts({ requiredEmbedding: "game", profile, fonts, locales, targetLocales: ["en"] }))).toContain("min-size");
  });

  it("프로파일에 typography 가 없으면 예산·크기는 unmeasured 로 남기고 나머지는 판정한다", () => {
    const fonts = [{ ...ok, embedding: ["web"], sizeKb: 99999, minSizePx: 1 }];
    const r = checkFonts({ requiredEmbedding: "game", profile: {}, fonts, locales, targetLocales: ["en"] });
    expect(r.unmeasured).toContain("typography-baseline");
    expect(codes(r)).toContain("license-embedding");
    expect(codes(r)).not.toContain("font-size-budget");
    expect(codes(r)).not.toContain("min-size");
  });
  // gemini 리뷰 [HIGH]: CLI 진입점이 깨진 JSON 에 SyntaxError 스택트레이스를 뱉는다.
  // 실패는 맞지만 사유를 알 수 없다. 공유 헬퍼로 네 검사기 전부 같은 메시지를 내게 한다.
  it("깨진 JSON 은 스택트레이스가 아니라 사유가 있는 오류다", () => {
    expect(() => parseCliInput("{not json")).toThrow(/stdin 으로 받은 JSON/);
  });
  it("빈 입력은 빈 객체로 읽는다", () => {
    expect(parseCliInput("")).toEqual({});
    expect(parseCliInput("   \n")).toEqual({});
  });
  it("정상 JSON 은 그대로 읽는다", () => {
    expect(parseCliInput('{"genre":"obby-platformer"}')).toEqual({ genre: "obby-platformer" });
  });
});

// 요구 임베딩은 게임 고유 개념이 아니다 — 배경화면 앱도 임베딩 라이선스가 필요하고,
// 요구하는 종류만 다르다. 그래서 코드에 "game" 을 박지 않고 입력으로 받는다.
// 다만 **안 주면 건너뛰는 것이 아니라 미선언으로 낸다** — 모름은 허용이 아니다.
describe("requiredEmbedding", () => {
  const base = { name: "GameSans", embedding: ["game"], scripts: ["latin", "hangul"], sizeKb: 100, minSizePx: 18, subset: false };
  const codesOf = (r: any) => r.violations.map((v: any) => v.code);

  it("요구 임베딩을 주고 충족하면 통과한다", () => {
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts: [base], locales, targetLocales: ["en"] });
    expect(codesOf(r)).not.toContain("license-embedding");
    expect(codesOf(r)).not.toContain("required-embedding-undeclared");
  });

  it("요구 임베딩을 주고 불충족하면 잡는다", () => {
    const r = checkFonts({ requiredEmbedding: "game", profile, fonts: [{ ...base, embedding: ["web"] }], locales, targetLocales: ["en"] });
    expect(codesOf(r)).toContain("license-embedding");
  });

  it("요구 임베딩이 다르면 같은 폰트도 불충족이다", () => {
    const r = checkFonts({ requiredEmbedding: "installable", profile, fonts: [base], locales, targetLocales: ["en"] });
    expect(codesOf(r)).toContain("license-embedding");
  });

  it("요구 임베딩 미선언은 통과가 아니다 — 모름은 허용이 아니다", () => {
    const r = checkFonts({ profile, fonts: [base], locales, targetLocales: ["en"] });
    expect(codesOf(r)).toContain("required-embedding-undeclared");
  });

  it("typography 를 직접 줘도 예산·크기를 판정한다 — 장르 프로파일을 전제하지 않는다", () => {
    const r = checkFonts({ requiredEmbedding: "game", typography: { maxFontKb: 10, minSizePx: 18 },
      fonts: [base], locales, targetLocales: ["en"] });
    expect(codesOf(r)).toContain("font-size-budget");
    expect(r.unmeasured).toEqual([]);
  });
});
