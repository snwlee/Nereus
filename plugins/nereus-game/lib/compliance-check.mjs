// 유료 확률 아이템 규정 검사기.
//
// 시뮬레이터·타이쿤의 알 뽑기·펫 뽑기가 정확히 이것이다. 두 층에서 강제된다:
// 로블록스 정책(전역)과 한국 게임산업법(2024-03-22 시행).
// 출처와 확인일은 policy.json 에 있다.
//
// **이 검사기만 장르 프로파일을 받지 않는다.** 법적 요건이기 때문이다.
// 장르별 설정으로 두면 `maxOddsError: 5` 같은 값으로 **설정으로 규정을 끌 수 있다.**
// 확률 합이 100% 여야 하는 것은 오비든 타이쿤이든 같다.
import { surfacesFor, loadPolicy } from "./policy.mjs";
import { readCliInput, runCli } from "./cli-input.mjs";

// 확률을 더하면 부동소수점 오차가 난다(0.1 + 0.2 !== 0.3).
// 합을 그대로 100 과 비교하면 **정상인 계획이 위반으로 잡힌다** — 그러면 게이트를 못 쓴다.
const SUM_DECIMALS = 6;
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const decimalsOf = (n) => (String(n).split(".")[1] ?? "").length;

export function checkPaidRandom({ policy, plan } = {}) {
  const violations = [];
  const boxes = Array.isArray(plan?.boxes) ? plan.boxes : [];
  const luckItems = Array.isArray(plan?.luckItems) ? plan.luckItems : [];
  const required = surfacesFor(policy, plan?.markets);
  const decimalsForDisclaimer = Number(policy?.paidRandom?.oddsDecimalsForDisclaimer) || 4;

  // 인게임 화폐라도 Robux 로 살 수 있으면 유료다. 간접 구매(열쇠·스핀 티켓)도 유료다.
  // 무료 랜덤만 정책의 명시적 예외다 — 이것을 넓게 잡으면 규정을 우회하게 된다.
  const paidBoxes = boxes.filter((b) => b?.paid);

  for (const b of paidBoxes) {
    const name = b?.name ?? "";
    const outcomes = Array.isArray(b?.outcomes) ? b.outcomes : [];

    if (!outcomes.length) {
      violations.push({ code: "no-outcomes", box: name });
    } else {
      const sum = round(outcomes.reduce((a, o) => a + (Number(o?.odds) || 0), 0), SUM_DECIMALS);
      if (sum !== 100) {
        // 소수 4자리 이상을 쓰면 반올림 때문에 합이 100 이 안 될 수 있다.
        // 그때는 면책 문구가 있어야 통과한다 — 공식 문서가 허용하는 경로다.
        const fine = outcomes.some((o) => decimalsOf(o?.odds) >= decimalsForDisclaimer);
        if (!(fine && b?.roundingDisclaimer)) {
          violations.push({ code: "odds-sum", box: name, sum });
        }
      }
    }

    if (!b?.disclosedBeforePurchase) violations.push({ code: "odds-undisclosed", box: name });

    const declared = Array.isArray(b?.disclosureSurfaces) ? b.disclosureSurfaces : [];
    const missing = required.filter((s) => !declared.includes(s));
    if (missing.length) violations.push({ code: "disclosure-surface", box: name, missing });

    if (b?.hasUniqueOutcomes && !b?.dynamicRemainingOdds) {
      violations.push({ code: "unique-no-remaining-odds", box: name });
    }
  }

  const boxNames = new Set(boxes.map((b) => b?.name));
  for (const l of luckItems) {
    const item = l?.name ?? "";
    if (!String(l?.numericEffect ?? "").trim()) violations.push({ code: "luck-effect-unexplained", item });
    if (!l?.dynamicUpdate) violations.push({ code: "luck-no-dynamic-update", item });
    for (const t of Array.isArray(l?.affects) ? l.affects : []) {
      if (!boxNames.has(t)) violations.push({ code: "luck-target-missing", item, target: t });
    }
  }

  // 일부 지역은 유료 확률 아이템이 법적으로 금지돼 있다. PolicyService 의
  // ArePaidRandomItemsRestricted 가 참인 유저에게 줄 대체 경로가 없으면 그 지역에서 게임이 막힌다.
  if (paidBoxes.length && !String(plan?.restrictedFallback ?? "").trim()) {
    violations.push({ code: "no-restricted-fallback" });
  }

  return { violations };
}

// 실행 진입점. stdin 으로 { plan } 을 받는다. 정책은 policy.json 에서 읽는다.
// process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 64KiB 에서 잘린다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    const input = readCliInput();
    process.stdout.write(JSON.stringify(checkPaidRandom({ policy: loadPolicy(), plan: input.plan })) + "\n");
  });
}
