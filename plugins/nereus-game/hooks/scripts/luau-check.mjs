// Luau 파일 편집 직후 포맷(StyLua) → 린트(selene).
//
// 도구가 PATH 에 없으면 조용히 건너뛰고 종료 코드 0 으로 끝낸다.
// 이유: 이 저장소를 여는 모든 세션이 Luau 툴체인을 갖고 있지 않다(하네스를 개발하는 맥이 그렇다).
// 도구 부재로 편집이 막히면 하네스 자체를 고칠 수 없게 된다. 설치 안내는 nereus:setup 의 몫이다.
//
// 다만 **도구가 있는데 위반을 찾은 것은 다르다.** 그건 조용히 버리지 않고 경고로 올린다
// (리뷰 M2: 초판은 stdio 를 통째로 버려 selene 이 찾은 위반이 어디에도 안 떴다).
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { isRobloxProject } from "../../lib/roblox-stack.mjs";

const LUAU_EXT = /\.(luau|lua)$/i;
const TOOLS = ["stylua", "selene"];

const defaultDeps = {
  which: (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" }).status === 0,
  run: (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    return {
      label: `${cmd} ${args.join(" ")}`,
      status: r.status ?? 0,
      output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim(),
    };
  },
  warn: (msg) => process.stderr.write(`${msg}\n`),
};

/**
 * @param {{ tool_input?: { file_path?: string } }} input PostToolUse 훅 입력
 * @returns {string[]} 실제로 실행한 명령 목록
 */
export function luauCheck(input, deps = defaultDeps, fsx = { exists: (p) => fs.existsSync(p) }) {
  const file = input?.tool_input?.file_path;
  if (typeof file !== "string" || !LUAU_EXT.test(file)) return [];
  // 로블록스 프로젝트 밖에서는 돌리지 않는다. rokit 셰임이 PATH 에 있으면 which 는 통과하지만
  // 프로젝트 매니페스트가 없어 도구가 실패한다 — 그 실패를 경고로 올리면 소음만 된다.
  if (!isRobloxProject(input?.cwd ?? process.cwd(), fsx)) return [];
  const ran = [];
  for (const tool of TOOLS) {
    if (!deps.which(tool)) continue;
    const r = deps.run(tool, [file]);
    ran.push(r.label);
    if (r.status !== 0) deps.warn(`[nereus-game] ${r.label} 실패 (exit ${r.status})\n${r.output}`);
  }
  return ran;
}

// 훅으로 직접 실행될 때만 stdin 을 읽는다. 어떤 경우에도 0 으로 끝낸다
// (리뷰 M1: basename 비교는 같은 이름의 다른 스크립트에 오작동한다. 전체 URL 로 비교한다).
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
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
