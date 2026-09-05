// 테스트 실행 래퍼. 러너를 감지해 실행하고 결과를 evidence(작업트리 해시 + 종료코드)로 기록한다.
// 사용: node run-tests.mjs [--cmd "<명령>"]   (명령 생략 시 detectTestRunner 결과)
import { spawnSync } from "node:child_process";
import { detectTestRunner } from "../../../hooks/scripts/lib/stack.mjs";
import { recordEvidence } from "../../../hooks/scripts/lib/evidence.mjs";

const cwd = process.cwd();
const i = process.argv.indexOf("--cmd");
const cmd = i > -1 ? process.argv[i + 1] : detectTestRunner(cwd)?.command;
if (!cmd) { console.error("테스트 러너를 찾지 못했습니다. --cmd 로 명령을 지정하세요."); process.exit(2); }
console.error(`[evidence] running: ${cmd}`);
const r = spawnSync(cmd, { cwd, stdio: "inherit", shell: true, env: process.env });
const exitCode = r.status ?? 1;
const rec = recordEvidence(cwd, { command: cmd, exitCode });
console.error(`[evidence] recorded ${exitCode === 0 ? "PASS" : "FAIL"} hash=${rec.hash} → .nereus/evidence.json`);
process.exit(exitCode);
