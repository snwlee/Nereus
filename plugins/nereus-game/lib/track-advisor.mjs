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

// tasks.md 의 태스크 줄. 태스크가 아닌 체크박스(Steps 안의 항목)를 세면 규모가 몇 배로
// 부풀어 판정이 틀린다. 그래서 태스크 번호가 있는 줄만 센다.
//
// **형식이 둘이다.** spec 스킬이 greenfield 에 spec-kit 을, 기존 코드에 OpenSpec 을 쓰는데
// 둘이 내는 tasks.md 형식이 다르다. nereus:spec 형식만 읽다가 ToonTone 의 spec-kit
// tasks.md 에서 태스크 188개를 0개로 셌다 — 에러가 아니라 조용히 뒤집혔다(2026-09-13 실측).
const TASK_FORMATS = [
  // nereus:spec — 번호 뒤에 마침표가 온다. `- [ ] T1. 무언가를 한다`
  { id: "nereus", task: /^- \[[ x]\] T\d+\./gm, flow: /^- \[[ x]\] T\d+\..*\[flow\]/gm },
  // spec-kit — 번호 뒤가 공백이다. `- [x] T001 Flutter 프로젝트를 생성한다`
  // 끼워 넣은 태스크는 번호에 접미 문자가 붙는다(`T042a`). 이걸 빼면 조용히 과소 계수된다.
  { id: "spec-kit", task: /^- \[[ x]\] T\d+[a-z]?\s/gm, flow: /^- \[[ x]\] T\d+[a-z]?\s.*\[flow\]/gm },
];

// 어떤 형식이든 셀 수 있는 값. 태스크 수의 **상한**이다(Steps 체크박스가 섞인다).
// 게이트에 쓰면 안 되고, "못 셌다"와 "정말 0개"를 구분하는 데만 쓴다.
const CHECKBOX_LINE = /^\s*- \[[ x]\]/gm;

/**
 * tasks 내용에서 규모를 센다. 사람이 입력하면 추측이 들어간다 — 산출물에 이미 있는 값이다.
 *
 * `matched` 는 어느 형식으로 셌는지다. 어떤 형식도 못 알아보면 `null` —
 * **태스크가 0개인 것과 형식을 못 알아본 것은 전혀 다른 상태인데** 둘 다 `tasks: 0` 으로
 * 도착하면 호출자가 구분할 수 없다. 정규식을 넓히는 것만으로는 다음 형식에서 또 조용히 0 이 된다.
 *
 * @returns {{ tasks: number, flows: number, matched: string|null, checkboxes: number }}
 */
export function countScope(tasksText) {
  const text = String(tasksText ?? "");
  const checkboxes = (text.match(CHECKBOX_LINE) ?? []).length;

  for (const fmt of TASK_FORMATS) {
    const tasks = (text.match(fmt.task) ?? []).length;
    if (tasks === 0) continue;
    return { tasks, flows: (text.match(fmt.flow) ?? []).length, matched: fmt.id, checkboxes };
  }
  return { tasks: 0, flows: 0, matched: null, checkboxes };
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

  // countScope 가 형식을 못 알아봤으면 규모를 모르는 것이다. 상한(checkboxes)으로 대신
  // 판정하지 않는다 — Steps 체크박스가 섞여 몇 배로 부푼다. 모르는 채로 추천하되 모른다고 말한다.
  // scope 에 matched 가 아예 없는 호출(옛 호출부·직접 만든 scope)은 규모를 아는 것으로 본다 —
  // 없다고 모른다고 하면 기존 호출이 전부 scope-unknown 이 된다.
  const scopeUnknown = scope != null && "matched" in scope && scope.matched == null;
  if (scopeUnknown) {
    reasons.push({
      code: "scope-unknown",
      why: `tasks.md 의 태스크 형식을 알아보지 못해 규모를 세지 못했다(체크박스 ${Number(scope?.checkboxes) || 0}개). 규모 임계 비교를 건너뛴다 — 체크박스 총수는 태스크 수의 상한이라 그대로 쓰면 부풀어 판정이 틀린다.`,
    });
  }

  const overBudget = !scopeUnknown && Number.isFinite(maxTasks) && tasks > maxTasks;

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
