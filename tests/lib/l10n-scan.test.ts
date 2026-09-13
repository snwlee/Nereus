import { describe, it, expect } from "vitest";
import { scanL10n } from "../../plugins/nereus-l10n/lib/l10n-scan.mjs";
import { loadLocales } from "../../plugins/nereus-l10n/lib/locales.mjs";

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

// ── 실측 회귀 (ToonTone, 2026-09-13) ─────────────────────────────────────────
// 하네스를 실제 게임에 처음 붙였을 때 461건이 나왔고 진짜 결함은 0건이었다.
// 461:0 이면 사람이 게이트를 끈다. 아래 줄들은 ToonTone 소스에서 그대로 뜬 것이다 —
// 저장소를 읽지 않고 리터럴로 박는다. 읽으면 없을 때 조용히 건너뛰는 테스트가 된다.
describe("scanL10n — 사용자에게 도달하지 않는 문자열", () => {
  const scan = (sources: any[], extra: any = {}) =>
    scanL10n({ locales, base: "ko", tables: {}, sources, accessor: "l10n.", ...extra });
  const countOf = (r: any, reason: string) =>
    (r.skipped ?? []).filter((s: any) => s.reason === reason).reduce((a: number, s: any) => a + s.count, 0);

  it("l10n 도구 생성물은 위반이 아니다 — 고칠 대상은 소스 표다", () => {
    const r = scan([{
      file: "lib/l10n/generated/app_localizations_en.dart",
      text: "  String get hintGranted => 'Hint received';\n",
    }]);
    expect(r.violations).toEqual([]);
    expect(countOf(r, "generated")).toBeGreaterThanOrEqual(1);
  });

  it(".g.dart 도 생성물이다", () => {
    const r = scan([{ file: "lib/model/user.g.dart", text: "  const name = '사용자 이름';\n" }]);
    expect(r.violations).toEqual([]);
    expect(countOf(r, "generated")).toBe(1);
  });

  it("예외 메시지는 플레이어에게 도달하지 않는다", () => {
    const r = scan([{
      file: "lib/content/content_pack_codec.dart",
      text: "    throw ContentPackFormatException('최상위가 객체여야 한다');\n",
    }]);
    expect(r.violations).toEqual([]);
    expect(countOf(r, "dev-message")).toBe(1);
  });

  // ToonTone 의 예외 메시지는 대부분 여러 줄이다. throw 가 앞 줄에 있어 줄 단위로는 안 보인다 —
  // 96건 중 22건이 한 파일에서 이 양상으로 나왔다.
  it("여러 줄에 걸친 예외 메시지의 이어지는 줄도 개발자 메시지다", () => {
    const r = scan([{
      file: "lib/content/content_pack_codec.dart",
      text: "      throw ContentPackFormatException(\n        'schemaVersion 이 정수여야 한다',\n      );\n",
    }]);
    expect(r.violations).toEqual([]);
    expect(countOf(r, "dev-message")).toBe(1);
  });

  it("괄호가 닫히면 개발자 문맥도 끝난다 — 파일 나머지를 삼키지 않는다", () => {
    const r = scan([{
      file: "lib/features/play/play_page.dart",
      text: "      throw StateError(\n        '라운드가 없다',\n      );\n      Text('색을 맞춰보세요'),\n",
    }]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].line).toBe(4);
  });

  it("사용자 노출 문자열은 그대로 잡는다", () => {
    const r = scan([{ file: "lib/features/play/play_page.dart", text: "      Text('색을 맞춰보세요'),\n" }]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].code).toBe("hardcoded");
  });

  it("개발자 메시지가 섞인 파일에서도 위젯 줄은 남는다 — 파일 전체를 버리지 않는다", () => {
    const r = scan([{
      file: "lib/features/play/play_page.dart",
      text: "    throw StateError('라운드가 없다');\n      Text('색을 맞춰보세요'),\n",
    }]);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].line).toBe(2);
    expect(countOf(r, "dev-message")).toBe(1);
  });

  it("제외한 것은 조용히 버리지 않고 셈과 이유를 낸다", () => {
    const r = scan([{ file: "lib/model/user.g.dart", text: "  const a = '가나다';\n" }]);
    expect(r.skipped).toEqual([{ reason: "generated", count: 1 }]);
  });
});

describe("scanL10n — 제외 규칙은 데이터다", () => {
  const one = (file: string, extra: any = {}) =>
    scanL10n({ locales, base: "ko", tables: {}, sources: [{ file, text: "  const a = '가나다';\n" }], accessor: "l10n.", ...extra });

  it("exclude 를 안 주면 Dart 기본 패턴이 적용된다", () => {
    expect(one("lib/model/user.freezed.dart").violations).toEqual([]);
  });

  it("exclude.generated 를 주면 그것만 생성물이다", () => {
    const opts = { exclude: { generated: ["__gen__/"] } };
    expect(one("__gen__/a.dart", opts).violations).toEqual([]);
    expect(one("lib/model/user.g.dart", opts).violations).toHaveLength(1);
  });

  it("exclude.devMessage 를 주면 그 토큰만 개발자 메시지다", () => {
    const sources = [{ file: "a.dart", text: "  panic('가나다');\n  throw X('라마바');\n" }];
    const r = scanL10n({ locales, base: "ko", tables: {}, sources, accessor: "l10n.", exclude: { devMessage: ["panic("] } });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].line).toBe(2);
  });
});
