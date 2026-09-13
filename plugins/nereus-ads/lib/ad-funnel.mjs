// 퍼널 수익 레버 — **조언자다. 게이트가 아니다.**
//
// 다른 검사기는 violations 를 내고 통과·차단을 판정한다. 여기는 levers 와 unanswerable 을 낸다.
// 어디에 힘을 쓸지는 **사업 판단**이고, 하네스가 강제하면 하네스가 사업을 결정하게 된다.
// (nereus-game:track 의 같은 규율이다.)
//
// WallpaperEngineApp 수익 분석 보고서에서 **방법론만** 채굴했다(2026-09-13).
// eCPM·국가별 RPM·show rate 실제값은 우리 계정·시점 종속이라 넣지 않는다 —
// 조용히 낡은 수치가 틀린 확신을 만든다. 기준은 **입력으로 받고**, 판단 규칙만 여기 있다.
//
// ★ 핵심: 퍼널 단계를 뭉치지 않는다.
//     requests → matched → impressions → revenue
//                (matchRate)  (showRate)
//   match 가 낮으면 재고·미디에이션 문제고, show 가 낮으면 지면·동기 문제다.
//   도너 실측에서 리워드는 match 92% / show 17% 였다 — **채움은 멀쩡한데 보여주질 않았다.**
//   하나의 "효율" 지표로 뭉쳤다면 채움 쪽을 고쳤을 것이고, 아무것도 안 바뀌었을 것이다.
import { pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";

const ratio = (num, den) => (Number(den) > 0 ? Number(num) / Number(den) : null);
const share = (part, total) => (total > 0 ? part / total : null);

/**
 * @param formats `[{ format, requests, matched, impressions, revenue, clicks? }]`
 * @param targets `{ showRate?, matchRate?, maxCtr? }` — 없으면 그 판정을 **하지 않는다**
 * @returns `{ rates, bottleneck, levers, unanswerable }`
 */
export function analyzeFunnel({ formats = [], targets = null } = {}) {
  const rates = {};
  const bottleneck = {};
  const levers = [];
  const unanswerable = [];

  const totalImpressions = formats.reduce((s, f) => s + (Number(f?.impressions) || 0), 0);
  const totalRevenue = formats.reduce((s, f) => s + (Number(f?.revenue) || 0), 0);

  for (const f of formats) {
    const name = f?.format;
    const matchRate = ratio(f?.matched, f?.requests);
    const showRate = ratio(f?.impressions, f?.matched);
    const ctr = ratio(f?.clicks, f?.impressions);
    const impressionShare = share(Number(f?.impressions) || 0, totalImpressions);
    const revenueShare = share(Number(f?.revenue) || 0, totalRevenue);
    rates[name] = { matchRate, showRate, ctr, impressionShare, revenueShare };

    // 기준이 없으면 판정하지 않는다. 기본값을 지어내면 그럴듯하게 틀린다.
    if (targets) {
      // **매치를 먼저 본다.** 매치가 모자라면 지면을 아무리 늘려도 보여줄 재고가 없다.
      if (matchRate != null && targets.matchRate != null && matchRate < targets.matchRate) {
        bottleneck[name] = "match";
      } else if (showRate != null && targets.showRate != null && showRate < targets.showRate) {
        bottleneck[name] = "show";
        unanswerable.push({
          question: `${name} 의 show rate 가 왜 낮은가`,
          needs: "앱 내 이벤트 로그. 지면 노출 빈도·리워드 동기·원격 설정 상태는 광고 리포트로 알 수 없다.",
        });
      }
      if (ctr != null && targets.maxCtr != null && ctr > targets.maxCtr) {
        unanswerable.push({
          question: `${name} 의 높은 CTR 이 실제 오클릭인가`,
          needs: "AdMob 정책 리포트와 무효 트래픽 공제 데이터. 수익 리포트만으로는 구분되지 않는다.",
        });
      }
    }

    // 믹스 역전은 기준 없이도 판정된다 — **점유율끼리의 비교**라 외부 기준이 필요 없다.
    // 포맷이 하나면 점유율이 1 이라 비교가 의미 없다.
    if (formats.length > 1 && impressionShare != null && revenueShare != null && impressionShare > revenueShare) {
      levers.push({
        format: name,
        code: "mix-inversion",
        impressionShare,
        revenueShare,
        // **줄이라고 말하지 않는다.** 줄이라는 처방은 지켜지지 않고, 지켜지지 않는 처방은 꺼진다.
        // 답은 제거가 아니라 재배분이다 — 같은 노출 1건의 가치가 포맷마다 다르다.
        advice: `노출 점유가 수익 점유보다 크다. 이 포맷의 문제가 아니라 **믹스** 신호다 — 노출 일부를 단가가 높은 포맷으로 재배분할 여지를 본다.`,
      });
    }
  }

  if (!targets) {
    unanswerable.push({
      question: "기준이 없어 이 비율들이 좋은지 나쁜지 판정하지 않았다",
      needs: "targets.showRate · targets.matchRate. 기준 없이 판정하면 그럴듯하게 틀린다 — 그래서 병목을 비워 둔다.",
    });
  }

  // 항상 적는다. A~D 의 모든 증분은 **현재 matched 를 가정**하므로,
  // 트래픽이 빠지면 개선 효과가 그대로 상쇄된다.
  unanswerable.push({
    question: "트래픽 자체가 유지되는가",
    needs: "기간별 matched 추이와 스토어 콘솔 데이터. 모든 레버 추정은 현재 트래픽 수준을 가정한다.",
  });

  return { rates, bottleneck, levers, unanswerable };
}

// 실행 진입점. 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
// pathToFileURL 을 쓴다 — `file://${argv[1]}` 은 Windows 경로에서 깨진다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(analyzeFunnel(readCliInput())) + "\n");
  });
}
