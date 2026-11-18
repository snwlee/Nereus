import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  claimedTasks, claimWork, releaseWork, prepareSessionState, archiveTransaction,
} from "../../../hooks/scripts/lib/session-documents.mjs";
import { sessionTaskProgress } from "../../../hooks/scripts/lib/tasks.mjs";

function runArchive(cwd, change) {
  // npm's Windows executable is a command shim. The change name is restricted by archiveWork.
  const result = spawnSync("openspec", ["archive", change, "--yes"], {
    cwd, stdio: "inherit", shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`OpenSpec archive 실패 (${result.status ?? result.signal})`);
}

export function archiveWork(cwd, sessionId, run = runArchive) {
  return archiveTransaction(cwd, sessionId, (root) => {
    const tasks = claimedTasks(root, sessionId);
    const change = tasks?.match(/^openspec\/changes\/([a-zA-Z0-9][a-zA-Z0-9_-]*)\/tasks\.md$/)?.[1];
    if (!change) throw new Error("이 세션에 등록된 OpenSpec change가 없습니다.");
    if (!sessionTaskProgress(root, sessionId)?.complete) {
      throw new Error(`${tasks}의 태스크를 모두 완료한 뒤 archive 하세요.`);
    }
    run(root, change);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , command, sessionId, file] = process.argv;
  const cwd = process.cwd();
  try {
    if (!sessionId || sessionId === "nosession") throw new Error("현재 세션 ID가 필요합니다.");
    switch (command) {
      case "claim": console.log(claimWork(cwd, sessionId, file)); break;
      case "current": {
        const tasks = claimedTasks(cwd, sessionId);
        if (!tasks) throw new Error("이 세션에 등록된 작업이 없습니다.");
        console.log(tasks);
        break;
      }
      case "notes": console.log(prepareSessionState(cwd, sessionId)); break;
      case "release": releaseWork(cwd, sessionId); break;
      case "archive": archiveWork(cwd, sessionId); break;
      default: throw new Error("사용법: session-work.mjs claim|current|notes|release|archive SESSION_ID [TASKS_FILE]");
    }
  } catch (error) {
    console.error(`[nereus] ${error.message}`);
    process.exitCode = 2;
  }
}
