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

  // 네트워크·API 오류로 예외가 나면 finish 전체가 죽는다. 실패로 판정하고 사유를 남긴다.
  let r;
  try {
    r = await run({
      universeId: env.ROBLOX_UNIVERSE_ID,
      placeId: env.ROBLOX_PLACE_ID,
      apiKey: env.ROBLOX_API_KEY,
      script,
      timeoutSeconds,
    });
  } catch (e) {
    return { status: "failed", pass: false, reason: `2단 호출 실패: ${e?.message ?? e}`, logs: [] };
  }

  return {
    status: r?.pass ? "passed" : "failed",
    pass: Boolean(r?.pass),
    reason: r?.reason ?? "",
    logs: Array.isArray(r?.logs) ? r.logs : [],
  };
}

// 실행 진입점. 스킬이 `node lib/roblox-gate.mjs` 로 부른다.
// export 를 SKILL.md 에 적는 것만으로는 배선이 아니다 — 실행 경로가 있어야 한다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  robloxStageTwo({ cwd: process.cwd(), env: process.env })
    .then((r) => {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.pass ? 0 : 1);
    })
    .catch((e) => {
      process.stdout.write(`${JSON.stringify({ status: "failed", pass: false, reason: String(e) })}\n`);
      process.exit(1);
    });
}
