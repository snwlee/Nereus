// Open Cloud Luau Execution — 로블록스 2단 테스트 게이트.
//
// 1단(lune)은 순수 Luau 로직을 초 단위로 돌린다. 2단인 여기는 **실제 Roblox 서버**에서
// DataModel 포함 통합 테스트를 돌린다. 1단만으로는 엔진 의존 코드가 검증되지 않는다.
//
// **HTTP 를 주입받는다.** 직접 fetch 를 부르면 테스트가 네트워크와 자격증명에 묶이고,
// 그러면 "게이트를 만들었는데 돌려본 적 없음" 상태가 된다 — 이번 프로젝트에서 반복해 물린 부류다.

export const MAX_TASK_SECONDS = 300; // 태스크 상한 5분
export const MAX_CONCURRENT = 10;    // 플레이스당 동시 태스크

const API = "https://apis.roblox.com/cloud/v2";
const TERMINAL = { COMPLETE: true, FAILED: false, CANCELLED: false };

/**
 * @param {{universeId:string, placeId:string, script:string, apiKey:string, timeoutSeconds?:number, pollMs?:number}} input
 * @param {{http:Function, sleep:Function}} deps
 */
export async function runLuauTask(input, deps) {
  const { universeId, placeId, script, apiKey, timeoutSeconds = 60, pollMs = 2000 } = input ?? {};

  if (timeoutSeconds > MAX_TASK_SECONDS) {
    throw new Error(
      `Luau Execution 태스크 상한은 ${MAX_TASK_SECONDS}초다(요청 ${timeoutSeconds}초). 태스크를 쪼개라.`,
    );
  }
  // 자격증명이 없으면 네트워크를 부르지 않는다. 게이트가 "설정 안 됨"과 "실패"를 구분해야 한다.
  if (!apiKey) {
    return { configured: false, pass: false, state: null, logs: [], reason: "ROBLOX_API_KEY 가 없다" };
  }

  const headers = { "x-api-key": apiKey, "content-type": "application/json" };
  const created = await deps.http(`${API}/universes/${universeId}/places/${placeId}/luau-execution-sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ script }),
  });

  const path = created?.path ?? `tasks/${created?.taskId ?? ""}`;
  const deadline = timeoutSeconds * 1000;
  let waited = 0;
  let last = created;

  while (!(last?.state in TERMINAL)) {
    if (waited >= deadline) {
      return { configured: true, pass: false, state: last?.state ?? null, logs: [], reason: "폴링 타임아웃" };
    }
    await deps.sleep(pollMs);
    waited += pollMs;
    last = await deps.http(`${API}/${path}`, { method: "GET", headers });
  }

  return {
    configured: true,
    pass: TERMINAL[last.state] === true,
    state: last.state,
    logs: Array.isArray(last?.logs) ? last.logs : [],
    output: last?.output ?? null,
  };
}
