// 스토어 등재 게이트.
//
// ★ 핵심: **미달은 위반이 아니다.** 요구 집합(Play 86) 대비 진행 상태는 coverage 이고,
//   위반은 **선언과 실제가 어긋난 것**뿐이다. 미달을 위반으로 내면 현재 운영 중인
//   플레이버 전부가 즉시 빨개지고, 그러면 사람이 게이트를 끈다.
//   (ToonTone 461:0 의 교훈 — 끄게 만드는 게이트는 게이트가 아니다.)
import { describe, it, expect } from "vitest";
import { checkStoreL10n } from "../../plugins/nereus-l10n/lib/store-l10n-check.mjs";

const listing = (title: string, short = "s") => ({ title, shortDescription: short });
const codes = (r: any) => r.violations.map((v: any) => v.code);
// 로케일이 하나뿐이면 "전 로케일 동일"이 자명참이라 미번역 판정이 의미 없다.
const DNT = [{ field: "title", why: "검색 키워드" }, { field: "shortDescription", why: "테스트" }];

describe("스토어 등재 게이트", () => {
  it("선언했는데 필드가 비면 잡는다 — Play 가 조용히 fallback 한다", () => {
    const r = checkStoreL10n({
      store: "play",
      declaredLocales: ["en-US", "ko-KR"],
      listings: { "en-US": listing("A"), "ko-KR": listing("") },
    });
    expect(codes(r)).toContain("declared-but-empty");
  });

  it("요구 집합 미달은 위반이 아니라 coverage 다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") }, doNotTranslate: DNT,
    });
    expect(r.violations).toEqual([]);
    expect(r.coverage.required).toBe(86);
    expect(r.coverage.present).toBe(1);
    expect(r.coverage.missing.length).toBe(85);
  });

  it("대상 로케일을 선언하지 않으면 전체를 요구한다 — 미설정은 보호다", () => {
    const r = checkStoreL10n({ store: "play", listings: {}, doNotTranslate: DNT });
    expect(r.coverage.required).toBe(86);
    expect(r.coverage.present).toBe(0);
  });

  it("제외는 이유와 셈을 같이 낸다 — 삭제가 아니라 분류다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") },
      excluded: [{ locale: "my-MM", why: "번역자 없음" }], doNotTranslate: DNT,
    });
    const sk = r.skipped.find((s: any) => s.reason === "excluded");
    expect(sk.count).toBe(1);
    expect(sk.locales).toContain("my-MM");
    expect(r.coverage.missing).not.toContain("my-MM");
    expect(r.coverage.required).toBe(85);
  });

  it("이유 없는 제외는 제외가 아니다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") },
      excluded: [{ locale: "my-MM" }], doNotTranslate: DNT,
    });
    expect(codes(r)).toContain("declaration-without-why");
    expect(r.coverage.missing).toContain("my-MM");
  });

  it("스토어 형식이 아닌 코드를 잡는다 — 그 로케일은 그냥 안 생긴다", () => {
    const r = checkStoreL10n({ store: "play", declaredLocales: ["ko"], listings: { ko: listing("A") } });
    expect(codes(r)).toContain("locale-code-unknown");
  });

  it("필드 길이 제한을 넘으면 잡는다 — 잘린 채 발행된다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("x".repeat(31)) }, doNotTranslate: DNT,
    });
    const v = r.violations.find((x: any) => x.code === "field-length-overflow");
    expect(v.field).toBe("title");
    expect(v.limit).toBe(30);
    expect(v.length).toBe(31);
  });

  it("제한이 선언되지 않은 스토어는 통과로 내지 않고 미검사로 보고한다", () => {
    const r = checkStoreL10n({
      store: "appStore", declaredLocales: ["en-US"], listings: { "en-US": listing("x".repeat(999)) }, doNotTranslate: DNT,
    });
    expect(codes(r)).not.toContain("field-length-overflow");
    expect(r.unmeasured).toContain("field-limits:appStore");
  });

  it("알 수 없는 스토어는 던진다 — 조용히 빈 결과를 내지 않는다", () => {
    expect(() => checkStoreL10n({ store: "nope", listings: {} })).toThrow(/스토어/);
  });
});

// 번역하지 않기로 한 것은 **선언**해야 한다. 하네스는 번역 여부를 정하지 않는다 —
// 앱 이름은 검색 키워드라 번역하면 유입이 끊기고, 설명문은 번역 안 하면 전환이 깎인다.
// 필드마다 답이 다르고 그건 사업 판단이다. 강제하는 것은 **판단이 기록에 남는 것**뿐이다.
describe("번역 제외 선언", () => {
  const two = { "en-US": listing("Same", "a"), "ko-KR": listing("Same", "b") };
  const decl = ["en-US", "ko-KR"];

  it("전 로케일 동일 문자열인데 선언이 없으면 잡는다", () => {
    const r = checkStoreL10n({ store: "play", declaredLocales: decl, listings: two });
    const v = r.violations.find((x: any) => x.code === "untranslated-undeclared");
    expect(v.field).toBe("title");
  });

  it("이유와 함께 선언되어 있으면 통과한다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: decl, listings: two,
      doNotTranslate: [{ field: "title", why: "앱 이름이 검색 키워드다" }],
    });
    expect(codes(r)).not.toContain("untranslated-undeclared");
  });

  it("이유 없는 선언을 잡는다 — 이유 없는 경계가 가장 먼저 지워진다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: decl, listings: two, doNotTranslate: [{ field: "title" }],
    });
    expect(codes(r)).toContain("declaration-without-why");
  });

  it("로케일이 하나면 미번역을 판정하지 않는다 — 동일이 자명참이라 의미가 없다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("Solo") },
    });
    expect(codes(r)).not.toContain("untranslated-undeclared");
  });
});

// 렌더러는 빠진 글리프를 두부로 그리고 **exit 0** 한다. 로케일 하나가 통째로
// 두부로 나가는데 모든 게이트가 초록이다. 하네스는 폰트를 파싱하지 않는다 —
// 실제 렌더러가 쓰는 폰트와 다를 수 있어서 파싱해도 그 사고를 못 막는다. 증거를 요구한다.
describe("두부 증거와 RTL 런", () => {
  const DNT2 = [{ field: "title", why: "x" }, { field: "shortDescription", why: "y" }];
  const ok = { glyphCheck: { ranAt: "2026-09-13", tool: "fonttools", missing: [] } };

  it("글리프 검증 증거가 없으면 통과시키지 않는다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["ko-KR"], listings: { "ko-KR": listing("A") },
      render: { "ko-KR": {} }, doNotTranslate: DNT2,
    });
    expect(codes(r)).toContain("tofu-unverified");
  });

  it("증거에 빠진 글리프가 있으면 잡는다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["ko-KR"], listings: { "ko-KR": listing("A") },
      render: { "ko-KR": { glyphCheck: { ranAt: "2026-09-13", tool: "fonttools", missing: [{ face: "Oswald", chars: "가나" }] } } },
      doNotTranslate: DNT2,
    });
    const v = r.violations.find((x: any) => x.code === "glyph-missing");
    expect(v.face).toBe("Oswald");
  });

  it("렌더 대상이 아닌 로케일은 두부 검사를 하지 않는다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["ko-KR"], listings: { "ko-KR": listing("A") }, doNotTranslate: DNT2,
    });
    expect(codes(r)).not.toContain("tofu-unverified");
  });

  it("RTL 타이틀을 쪼개 그리면 잡는다 — 공백이 사라지고 순서가 뒤집힌다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["ar"], listings: { ar: listing("A") },
      render: { ar: { ...ok, titleRuns: 2 } }, doNotTranslate: DNT2,
    });
    expect(codes(r)).toContain("rtl-split-run");
  });

  it("LTR 은 쪼개도 된다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": listing("A") },
      render: { "en-US": { ...ok, titleRuns: 2 } }, doNotTranslate: DNT2,
    });
    expect(codes(r)).not.toContain("rtl-split-run");
  });

  it("RTL 이어도 한 런이면 통과한다", () => {
    const r = checkStoreL10n({
      store: "play", declaredLocales: ["ar"], listings: { ar: listing("A") },
      render: { ar: { ...ok, titleRuns: 1 } }, doNotTranslate: DNT2,
    });
    expect(codes(r)).not.toContain("rtl-split-run");
  });
});
