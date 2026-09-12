// Luau 파일 편집 직후 포맷(StyLua) → 린트(selene).
//
// 도구가 PATH 에 없으면 조용히 건너뛰고 종료 코드 0 으로 끝낸다.
// 이유: 이 저장소를 여는 모든 세션이 Luau 툴체인을 갖고 있지 않다(하네스를 개발하는 맥이 그렇다).
// 도구 부재로 편집이 막히면 하네스 자체를 고칠 수 없게 된다. 설치 안내는 nereus:setup 의 몫이다.
import { spawnSync } from "node:child_process";

const LUAU_EXT = /\.(luau|lua)$/i;
const TOOLS = ["stylua", "selene"];

const defaultDeps = {
  which: (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" }).status === 0,
  run: (cmd, args) => {
    spawnSync(cmd, args, { stdio: "ignore" });
    return `${cmd} ${args.join(" ")}`;
  },
};

/**
 * @param {{ tool_input?: { file_path?: string } }} input PostToolUse 훅 입력
 * @returns {string[]} 실제로 실행한 명령 목록
 */
export function luauCheck(input, deps = defaultDeps) {
  const file = input?.tool_input?.file_path;
  if (typeof file !== "string" || !LUAU_EXT.test(file)) return [];
  const ran = [];
  for (const tool of TOOLS) {
    if (!deps.which(tool)) continue;
    ran.push(deps.run(tool, [file]));
  }
  return ran;
}

// 훅으로 직접 실행될 때만 stdin 을 읽는다. 어떤 경우에도 0 으로 끝낸다.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  let raw = "";
  process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => {
    try {
      luauCheck(JSON.parse(raw || "{}"));
    } catch {
      // 훅은 진단 대상 때문에 죽지 않는다
    }
    process.exit(0);
  });
}
