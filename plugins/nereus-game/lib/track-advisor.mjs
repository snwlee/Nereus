// 트랙 추천기 — 다작(many) 인가 깊게 하나(deep) 인가.
//
// **이것만 게이트가 아니다.** 다른 lib 은 violations 를 내지만 여기는 추천과 근거를 낸다.
// 트랙 선택은 사업 판단이지 기술 판정이 아니다. "이 게임은 다작으로 가면 안 된다"를
// 하네스가 강제하면 하네스가 사업을 결정하게 된다. 근거를 주고 판단은 사람이 한다.
//
// 순서가 중요하다: **깊게를 강제하는 조건이 먼저**다.
// "다작이 좋다/나쁘다"가 아니라 구조적으로 다작이 불가능한 조건이 있다.
// 아무것도 안 걸릴 때만 규모를 본다.
import { platformRule, revenueRule, loadTracks } from "./tracks.mjs";
import { readCliInput, runCli } from "./cli-input.mjs";

// spec 이 만든 tasks.md 의 형식. "- [ ] T1." / "- [x] T2." 만 태스크로 센다 —
// 태스크가 아닌 체크박스(Steps 안의 항목)를 세면 규모가 몇 배로 부풀어 판정이 틀린다.
const TASK_LINE = /^- \[[ x]\] T\d+\./gm;
const FLOW_LINE = /^- \[[ x]\] T\d+\..*\[flow\]/gm;

/** tasks 내용에서 규모를 센다. 사람이 입력하면 추측이 들어간다 — 산출물에 이미 있는 값이다. */
export function countScope(tasksText) {
  const text = String(tasksText ?? "");
  return {
    tasks: (text.match(TASK_LINE) ?? []).length,
    flows: (text.match(FLOW_LINE) ?? []).length,
  };
}

export function recommendTrack({ tracks, scope, model } = {}) {
  // 모르는 값은 기본값으로 떨어지지 않고 던진다. 그럴듯한 채로 틀린 판정이 판정 없는 것보다 나쁘다.
  const pRule = platformRule(tracks, model?.platform);
  const rRule = revenueRule(tracks, model?.revenue);

  const reasons = [];
  if (pRule.forcesDeep) reasons.push({ code: `platform-${model.platform}`, why: pRule.why });
  if (rRule.forcesDeep) reasons.push({ code: `revenue-${model.revenue}`, why: rRule.why });
  if (model?.liveEvents) {
    reasons.push({ code: "live-events", why: "시즌·이벤트는 정의상 지속 운영이다. 내고 잊을 수 없다." });
  }
  if (model?.persistentMultiplayer) {
    reasons.push({ code: "persistent-multiplayer", why: "서버 상태와 진행도가 살아 있어야 한다. 운영이 따라붙는다." });
  }

  const forced = reasons.length > 0;
  const maxTasks = Number(tracks?.manyTrack?.maxTasks);
  const tasks = Number(scope?.tasks) || 0;
  const overBudget = Number.isFinite(maxTasks) && tasks > maxTasks;

  if (!forced && overBudget) {
    reasons.push({
      code: "scope-exceeds-many",
      why: `태스크 ${tasks}개가 다작 임계 ${maxTasks}개를 넘는다. 다작 사이클로는 끝나지 않는다.`,
      estimate: true,   // 임계값이 추정이므로 이 근거도 추정이다. 조용한 추정은 틀린 확신을 만든다.
      basis: tracks?.manyTrack?.basis,
    });
  }

  const recommendation = forced || overBudget ? "deep" : "many";

  // 불일치는 추천과 **독립적으로** 계산한다. deep 추천이어도 모순은 모순이다.
  // 라벨만 주면 정작 중요한 것을 놓친다.
  const mismatches = [];
  if (model?.revenue === "premium" && model?.liveEvents) {
    mismatches.push({
      code: "premium-with-live-events",
      why: "유료 단품인데 라이브 이벤트를 계획했다. 두 수익 모델이 섞였다 — 판매는 한 번이고 운영은 계속이다.",
    });
  }
  // 강제 조건이 걸렸으면 애초에 다작이 아니므로 "다작 예산 초과"는 의미가 없다.
  if (!forced && overBudget) {
    mismatches.push({
      code: "scope-over-budget",
      why: "다작을 막는 구조적 조건은 없는데 규모만 크다. 범위를 줄이면 다작이 가능하다.",
      tasks,
      maxTasks,
      estimate: true,
    });
  }

  return { recommendation, reasons, mismatches };
}

// 실행 진입점. stdin 으로 { tasksText, model } 을 받는다.
// process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 64KiB 에서 잘린다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    const input = readCliInput();
    const scope = countScope(input.tasksText);
    const result = recommendTrack({ tracks: loadTracks(), scope, model: input.model });
    process.stdout.write(JSON.stringify({ ...result, scope }) + "\n");
  });
}
