// 로블록스 2단 테스트 배선. finish 단계가 이것을 부른다.
//
// **네 상태를 섞지 않는다.** 섞으면 게이트가 거짓말을 한다.
//   skipped      — 로블록스 프로젝트가 아니다. 시도하지 않는다
//   unconfigured — 자격증명이 없다. **통과시킨다** — 막으면 키 없는 모든 세션에서 finish 가 불가능해지고
//                  하네스 자체를 고칠 수도 없게 된다(로블록스 훅에서 이미 같은 판단을 했다)
//   failed       — 실제로 돌렸고 실패했다. 차단
//   passed       — 실제로 돌렸고 통과했다
import { isRobloxProject } from "./roblox-stack.mjs";
import { runLuauTask } from "./luau-exec.mjs";

const KEYS = ["ROBLOX_API_KEY", "ROBLOX_UNIVERSE_ID", "ROBLOX_PLACE_ID"];

/**
 * @param {{cwd:string, env?:Record<string,string>, script?:string, timeoutSeconds?:number}} input
 * @param {{fsx?:object, run?:Function}} deps
 */
export async function robloxStageTwo(input, deps = {}) {
  const { cwd, env = {}, script = "return true", timeoutSeconds = 120 } = input ?? {};
  const fsx = deps.fsx;
  const run = deps.run ?? runLuauTask;

  if (!isRobloxProject(cwd, fsx)) {
    return { status: "skipped", pass: true, reason: "로블록스 프로젝트가 아니다", logs: [] };
  }

  const missing = KEYS.filter((k) => !env[k]);
  if (missing.length) {
    return {
      status: "unconfigured",
      pass: true,
      reason: `2단 테스트 미설정 — ${missing.join(", ")} 가 없다. Open Cloud 키를 넣으면 실런타임 검증이 켜진다`,
      logs: [],
    };
  }

  const r = await run({
    universeId: env.ROBLOX_UNIVERSE_ID,
    placeId: env.ROBLOX_PLACE_ID,
    apiKey: env.ROBLOX_API_KEY,
    script,
    timeoutSeconds,
  });

  return {
    status: r?.pass ? "passed" : "failed",
    pass: Boolean(r?.pass),
    reason: r?.reason ?? "",
    logs: Array.isArray(r?.logs) ? r.logs : [],
  };
}
