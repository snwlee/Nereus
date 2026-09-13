// 현지화 검사기. 번역을 실행하지 않고, 번역하면 깨질 곳을 지금 찾는다.
// 출시 후에 발견하면 고치는 비용이 몇 배가 된다.
import { expansionOf, localeIds } from "./locales.mjs";

// 사용자 노출로 볼 문자열: 한글·CJK 가 있거나, 두 글자 이상 단어 뒤에 공백이 오는 것.
// 식별자·경로·포맷 토큰을 사용자 문장으로 오인하지 않기 위한 최소 조건이다.
const USER_FACING = /[가-힣ぁ-んァ-ヶ一-龥]|[A-Za-z]{2,}\s/;
const LITERAL = /"([^"\n]{2,})"|'([^'\n]{2,})'/g;
const COMMENT = /^\s*(--|\/\/|#)/;

// 사용자에게 도달하지 않는 문자열. ToonTone 실측에서 461건 중 진짜 결함이 0건이었고,
// 그중 상당수가 l10n 도구가 **직접 만든** 번역 테이블이었다 — 정확히 거꾸로다.
// 461:0 이면 사람이 게이트를 끈다. 끄게 만드는 게이트는 게이트가 아니다. (2026-09-13)
//
// 패턴은 언어·프레임워크마다 다르다(`.g.dart` 는 Dart, `.generated.cs` 는 Unity).
// 코드에 박으면 스택이 늘 때마다 이 파일을 고치게 되므로 호출자가 exclude 로 덮어쓸 수 있다.
// 기본값이 없으면 호출자가 매번 전부 선언해야 해서 아무도 안 쓴다.
const DEFAULT_GENERATED = ["generated/", ".g.dart", ".freezed.dart", ".gen.dart", ".generated.cs", ".designer.cs"];
const DEFAULT_DEV_MESSAGE = ["throw ", "assert(", "Exception(", "Error(", "debugPrint(", "console.error", "console.warn", "Debug.Log"];

export function scanL10n({ locales, base = "", tables = {}, sources = [], maxWidth = 0, accessor = "L(", fontMetrics = null, exclude = null } = {}) {
  const known = new Set(localeIds(locales));
  for (const id of Object.keys(tables)) {
    // 조용히 건너뛰면 그 로케일이 검사되지 않은 채 통과한다. 던지는 편이 낫다.
    if (!known.has(id)) throw new Error(`알 수 없는 로케일: ${id} (있는 것: ${[...known].join(", ")})`);
  }
  // checkFonts 는 fonts 를 **배열**로 받고 여기는 **로케일 키 객체**로 받는다.
  // 배열이 들어오면 fontMetrics[id] 가 전부 undefined 라 조용히 근사로 떨어진다 —
  // 위험한 fallback 이라 큰 소리로 막는다. (gemini 리뷰 [MEDIUM], 2026-09-13)
  if (Array.isArray(fontMetrics)) {
    throw new Error("fontMetrics 는 로케일 키 객체다 (예: { ko: { avgCharWidth: 1.0 } }). 배열은 checkFonts 의 fonts 인자다");
  }
  const baseId = base || locales?.base;
  const violations = [];

  const generatedPatterns = exclude?.generated ?? DEFAULT_GENERATED;
  const devMessageTokens = exclude?.devMessage ?? DEFAULT_DEV_MESSAGE;
  // 제외한 것은 조용히 버리지 않고 셈과 이유를 같이 낸다 —
  // 버리기만 하면 "검사해서 통과한 것"과 "아예 안 본 것"이 구분되지 않는다.
  const skippedCounts = new Map();
  const skip = (reason) => skippedCounts.set(reason, (skippedCounts.get(reason) ?? 0) + 1);

  for (const src of sources) {
    const file = src?.file ?? "";
    // 생성물 판정은 파일 단위지만, 개발자 메시지 판정은 **줄 단위**다.
    // 생성물이 아닌 파일에도 개발자 메시지는 섞여 있고 그 파일의 사용자 문자열은 계속 검사되어야 한다.
    const isGenerated = generatedPatterns.some((p) => file.includes(p));
    const lines = String(src?.text ?? "").split("\n");
    // 예외 메시지는 대부분 여러 줄에 걸친다 — `throw` 는 앞 줄에 있고 문자열은 다음 줄에 온다.
    // 줄 하나만 보면 ToonTone 에서 한 파일에 22건이 그대로 새어 나왔다. 그래서 문장이 끝날 때까지
    // 개발자 문맥을 들고 간다. 괄호 균형으로 문장 끝을 잡는다 — 괄호가 닫히면 문맥도 끝나
    // 파일 나머지를 삼키지 않는다. 파서가 아니라 근사이고, 그래서 문자열 안의 괄호도 센다.
    let devDepth = 0;
    lines.forEach((line, i) => {
      if (COMMENT.test(line) || line.includes(accessor)) return;
      const inDevStatement = devDepth > 0;
      const startsDevStatement = devMessageTokens.some((t) => line.includes(t));
      if (inDevStatement || startsDevStatement) {
        const opened = (line.match(/\(/g) ?? []).length;
        const closed = (line.match(/\)/g) ?? []).length;
        devDepth = Math.max(0, (inDevStatement ? devDepth : 0) + opened - closed);
      }

      const hits = [...line.matchAll(LITERAL)]
        .map((m) => m[1] ?? m[2] ?? "")
        .filter((text) => USER_FACING.test(text));
      if (hits.length === 0) return;
      if (isGenerated) return skip("generated");
      if (inDevStatement || startsDevStatement) return skip("dev-message");
      for (const text of hits) violations.push({ code: "hardcoded", file, line: i + 1, text });
    });
  }

  const baseTable = tables[baseId] ?? {};
  for (const id of Object.keys(tables)) {
    if (id === baseId) continue;
    for (const key of Object.keys(baseTable)) {
      if (!(key in tables[id])) violations.push({ code: "missing-key", locale: id, key });
    }
  }

  if (Number(maxWidth) > 0) {
    for (const id of Object.keys(tables)) {
      // 폰트 메트릭이 있으면 그것이 진짜 폭이다. 없으면 확장률로 근사하되 **근사라고 표시한다** —
      // 조용한 근사는 근사 없는 것보다 나쁘다. 틀린 확신을 주기 때문이다.
      const metric = Number(fontMetrics?.[id]?.avgCharWidth);
      const approx = !Number.isFinite(metric) || metric <= 0;
      const rate = approx ? expansionOf(locales, id) : metric;
      for (const [key, value] of Object.entries(baseTable)) {
        const width = String(value).length * rate;
        if (width > Number(maxWidth)) {
          violations.push({ code: "overflow", locale: id, key, width: Math.round(width * 100) / 100, maxWidth: Number(maxWidth), approx });
        }
      }
    }
  }

  return { violations, skipped: [...skippedCounts].map(([reason, count]) => ({ reason, count })) };
}
