// ASO 로케일 우선순위 — **조언자다. 게이트가 아니다.**
//
// store-l10n-check 는 violations 를 내고 통과·차단을 판정한다. 여기는 levers 와
// unanswerable 을 낸다. 어느 로케일을 먼저 채울지는 **사업 판단**이고,
// 하네스가 강제하면 하네스가 사업을 결정하게 된다.
// (nereus-game:track · nereus-ads 의 ad-funnel 과 같은 규율이다.)
//
// **실측 점유율을 이 파일에 넣지 않는다.** 도너(wallpaper-deploy)는 매출 점유로
// 로케일을 골랐지만 그 수치는 계정·시점 종속이라 빨리 낡고, 조용히 낡은 수치가
// 틀린 확신을 만든다. 기준은 `signals` 로 **입력받고**, 판단 규칙만 여기 있다.
import { pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";

/**
 * @param coverage store-l10n-check 의 `coverage` 를 그대로 넘긴다
 * @param signals  `{ share: { [locale]: number } }` — 없으면 **순위를 매기지 않는다**
 * @returns `{ levers, unanswerable }`
 */
export function adviseAso({ coverage = null, signals = null } = {}) {
  const levers = [];
  const unanswerable = [];
  const missing = Array.isArray(coverage?.missing) ? coverage.missing : [];

  if (!coverage) {
    unanswerable.push({
      question: "커버리지를 주지 않아 무엇이 비었는지 알 수 없어 아무 순위도 내지 않았다",
      needs: "store-l10n-check 의 coverage. 빠진 로케일 목록 없이는 레버가 성립하지 않는다.",
    });
  }

  const share = signals?.share ?? null;
  if (!share) {
    // 기본값을 지어내면 그럴듯하게 틀린다. 판정하지 않은 사실을 결과에 싣는다.
    unanswerable.push({
      question: "로케일별 점유 신호가 없어 무엇을 먼저 채울지 순위를 매기지 않았다",
      needs: "signals.share — 로케일별 매출 또는 설치 점유. 실측치는 계정·시점 종속이라 하네스에 두지 않고 그때 읽는다.",
    });
  } else {
    const ranked = missing
      .filter((id) => Number.isFinite(Number(share[id])))
      .sort((a, b) => Number(share[b]) - Number(share[a]));
    for (const locale of ranked) {
      levers.push({
        locale,
        code: "uncovered-with-share",
        share: Number(share[locale]),
        // 줄이라고 말하지 않는다. 이 조언의 처방은 언제나 "더 채운다"이지 "뺀다"가 아니다.
        advice: `점유가 있는데 등재가 비어 있다. 이 로케일 사용자는 지금 기본 로케일 텍스트를 본다 — 채우면 그 점유가 전환으로 바뀔 여지가 있다.`,
      });
    }
    const noSignal = missing.filter((id) => !Number.isFinite(Number(share[id])));
    if (noSignal.length > 0) {
      // 순위에 끼우지 않는다 — 신호 없는 것을 0 으로 보면 "점유가 없다"는 판정이 되어버린다.
      unanswerable.push({
        question: `빠진 로케일 ${noSignal.length}개는 점유 신호가 없어 순위에 넣지 않았다`,
        needs: `해당 로케일의 점유 신호. 신호 없음을 0 으로 읽으면 "점유가 없다"는 판정이 되는데 그건 측정한 적이 없는 것이다. 대상: ${noSignal.join(", ")}`,
      });
    }
  }

  // 항상 적는다. 하네스는 문자열의 존재와 길이만 본다 — 의미는 보지 않는다.
  unanswerable.push({
    question: "번역 품질이 충분한지는 판정하지 않았다",
    needs: "원어민 검수 또는 로케일별 전환 지표. 등재 텍스트의 존재·길이만으로는 알 수 없다.",
  });

  // 항상 적는다. 제목 번역의 손익은 등재 텍스트만으로 절대 풀 수 없다.
  unanswerable.push({
    question: "제목을 번역했을 때 유입이 늘지 줄지는 판정하지 않았다",
    needs: "Play Console 의 검색 유입 데이터. 앱 이름이 검색 키워드로 작동하는 정도는 등재 텍스트로 알 수 없다.",
  });

  return { levers, unanswerable };
}

// 실행 진입점. 검사기를 만들고 프로세스로 부르는 곳이 없으면 그것은 배선된 것이 아니다.
// pathToFileURL 을 쓴다 — `file://${argv[1]}` 은 Windows 경로에서 깨진다.
// 성공 경로에서 process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 64KiB 에서 잘린다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(adviseAso(readCliInput())) + "\n");
  });
}
