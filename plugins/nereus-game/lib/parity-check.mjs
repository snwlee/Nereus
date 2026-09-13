// 플레이버 패리티 검사기 — 다작 트랙의 핵심 코드 규율.
//
// ToonTone 헌법 원칙 VI 에서 채굴했다(2026-09-13):
//   "Dart source MUST be identical across every flavor. 어떤 형태든 `if flavor == X` 분기는
//    위반이다. 다른 동작은 설정으로 올려야 한다."
//   근거: "The business model is app volume. The moment flavors diverge in code,
//          the marginal cost of a new app stops being near zero and the model collapses."
//
// `track` 스킬은 다작/깊게를 **추천**만 한다. 다작을 **가능하게 하는 규율**이 없었다.
// 다작은 "게임을 여러 개 만든다"가 아니라 한 코드베이스의 한계 비용을 0 에 붙여두는 것이고,
// 그걸 무너뜨리는 것이 코드 분기다. 추천만 있고 규율이 없으면 다작 트랙은 선언으로만 남는다.
import { pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";

// 식별자 이름은 프로젝트마다 다르다. 데이터로 받고, 안 주면 흔한 것들을 쓴다.
const DEFAULT_IDENTIFIERS = ["flavor", "flavorId", "flavour", "variant", "productFlavor", "buildFlavor"];

// **식별자가 나오는 것 자체는 위반이 아니다** — 설정을 읽는 코드는 당연히 id 를 다룬다.
// 위반은 **플레이버 리터럴로 동작이 갈리는 것**이다.
//
// ToonTone 실측(2026-09-13): "식별자 + 비교 연산자"로만 보면 네 줄이 오탐으로 잡혔다.
//   if (expected != null && pack.flavorId != expected)   ← 변수 대 변수
//   if (flavorId is! String) return null;                ← 타입 검사
//   if (flavor == null || packageName == null)           ← 널 검사
// 셋 다 "갈리는" 게 아니라 **같은 코드가 모든 플레이버에서 도는 모습**이다.
// 그래서 비교 대상이 **문자열 리터럴**일 때만 잡는다.
const COMMENT = /^\s*(\/\/|--|#|\*)/;
const SWITCH = /\bswitch\s*\(/;
// `flavor == "skz"` / `flavorId === \'a\'` / `"skz" == flavor` — 양쪽 순서를 다 본다.
const literalCompare = (id) =>
  new RegExp(`\\b${id}\\b\\s*[!=]==?\\s*["']([^"']+)["']|["']([^"']+)["']\\s*[!=]==?\\s*\\b${id}\\b`);

const WHY =
  "플레이버 분기는 다작의 한계 비용을 올린다. 코드가 갈리는 순간 새 앱 하나의 비용이 0 에서 멀어지고, " +
  "그게 다작 모델이 성립하는 유일한 근거였다. 다른 동작은 코드가 아니라 설정으로 올린다.";

/**
 * 소스에서 플레이버로 동작이 갈리는 분기를 찾는다.
 *
 * `flavors` 가 둘 미만이면 **위반 없음이 아니라 해당 없음**이다 —
 * 깊게 트랙에는 플레이버라는 개념이 없다. "검사해서 깨끗함"과 "검사 대상이 아님"을
 * 같게 보고하면 검사되지 않은 것이 통과로 읽힌다.
 */
export function checkParity({ flavors = [], sources = [], identifiers = null } = {}) {
  const list = Array.isArray(flavors) ? flavors : [];
  if (list.length < 2) {
    return {
      applicable: false,
      violations: [],
      why: `플레이버가 ${list.length}개다. 패리티는 한 코드베이스를 여러 앱으로 낼 때의 규율이라 검사 대상이 아니다 — 깊게 트랙에는 플레이버라는 개념 자체가 없다.`,
    };
  }

  const ids = identifiers ?? DEFAULT_IDENTIFIERS;
  const violations = [];
  for (const src of sources) {
    const file = String(src?.file ?? "");
    String(src?.text ?? "").split("\n").forEach((line, i) => {
      if (COMMENT.test(line)) return;
      // 한 줄에 하나만 센다. 같은 줄에 식별자가 여럿이어도 위반은 "이 줄이 갈린다" 하나다.
      for (const id of ids) {
        if (!new RegExp(`\\b${id}\\b`).test(line)) continue;
        const m = line.match(literalCompare(id));
        const isSwitch = SWITCH.test(line);
        if (!m && !isSwitch) continue;
        const literal = m ? (m[1] ?? m[2]) : null;
        violations.push({
          code: "flavor-branch",
          file,
          line: i + 1,
          identifier: id,
          literal,
          // 목록에 있으면 확실하다. 없어도 잡는다 — 플레이버 목록이 최신이 아닐 수 있고,
          // 놓치는 쪽이 더 나쁘다(다작의 한계 비용이 조용히 올라간다).
          known: literal != null && list.includes(literal),
          text: line.trim(),
          why: WHY,
        });
        break;
      }
    });
  }
  return { applicable: true, violations, approx: true };
}

// 실행 진입점. stdin 으로 { flavors, sources, identifiers } 를 받아 JSON 을 낸다.
// 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    const input = readCliInput();
    process.stdout.write(JSON.stringify(checkParity(input)) + "\n");
  });
}
