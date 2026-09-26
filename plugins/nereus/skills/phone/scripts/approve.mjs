// 사람이 직접 실행하는 발신 승인. Claude Code 프롬프트에 `!` 를 붙여 친다:
//   ! node <플러그인>/skills/phone/scripts/approve.mjs JOB_ID
// 에이전트가 이 스크립트를 부르면 pre-tool-guard 가 막는다(phone-approve-by-human).
// 저장된 잡(call.mjs 판정 실행이 만든 파일)의 요약을 보여 주고 30분짜리 승인 토큰을 쓴다.

import { writeApproval } from "./approval.mjs";
import { loadJob } from "./probe.mjs";
import { paths } from "./config.mjs";

const id = process.argv[2];
const job = loadJob(id);
const { home } = paths();
writeApproval(`${home}/approvals`, id, job);
const questions = job.instructions.split("\n").filter((l) => /^ \d+\. /.test(l)).map((l) => l.trim()).join(" ");
console.log(`✅ 승인: ${id} → ${job.to} (${job.language}) · ${questions} · 30분 안에 걸어야 합니다`);
