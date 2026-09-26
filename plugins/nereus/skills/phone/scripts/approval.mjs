// 발신 승인 토큰. 사람이 `!` 로 직접 실행한 approve.mjs 만 만든다 — `!` 명령은 에이전트 도구 훅을 거치지 않고,
// 에이전트가 approve.mjs 를 부르거나 승인 폴더를 쓰는 것은 pre-tool-guard 기본 규칙이 막는다.
// 존재 이유(보안 리뷰 2026-09-26 R2): --approved 플래그·권한 창 ask 는 에이전트가 우회하거나 bypass 모드에서 안 뜰 수 있다.
// 토큰에는 잡 지문(번호·언어·지시문·상한·시간대)이 들어간다 — 승인 뒤 브리프가 바뀌면 다시 승인해야 한다.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const APPROVAL_TTL_MS = 30 * 60 * 1000;   // 승인하고 30분 안에 건다
const JOB_ID = /^[a-z0-9-]+$/;

export function digestJob(job) {
  const { to, language, instructions, timeLimitSec, hours } = job;
  return crypto.createHash("sha256").update(JSON.stringify({ to, language, instructions, timeLimitSec, hours })).digest("hex");
}

const fileOf = (dir, id) => {
  if (!JOB_ID.test(id || "")) throw new Error(`잘못된 잡 id: ${id}`);
  return path.join(dir, `${id}.json`);
};

export function writeApproval(dir, id, job, now = new Date()) {
  const file = fileOf(dir, id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  fs.writeFileSync(file, JSON.stringify({ digest: digestJob(job), at: now.toISOString() }), { mode: 0o600 });
  return file;
}

export function checkApproval(dir, id, job, now = new Date()) {
  const file = fileOf(dir, id);
  if (!fs.existsSync(file)) return { ok: false, reason: "approval-missing" };
  const a = JSON.parse(fs.readFileSync(file, "utf8"));
  if (a.digest !== digestJob(job)) return { ok: false, reason: "approval-mismatch" };
  if (now - new Date(a.at) > APPROVAL_TTL_MS) return { ok: false, reason: "approval-expired" };
  return { ok: true };
}

export const consumeApproval = (dir, id) => fs.rmSync(fileOf(dir, id), { force: true });
