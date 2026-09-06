// SessionStart: handoff.md 주입, codegraph 인덱스·외부 도구 상태 한 줄 요약.
import fs from "node:fs";
import path from "node:path";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import { handoffPath, userConfigDir } from "./lib/paths.mjs";
import { which } from "./lib/exec.mjs";
import { readAll, selectForInjection } from "./lib/learnings.mjs";
import { loadConfig } from "./lib/config.mjs";
import { readCandidates } from "./session-end.mjs";

export const REQUIRED_TOOLS = ["codegraph", "ooo", "ocr", "specify", "openspec", "typst", "agy", "codex"];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function toolStatusCached({ now = Date.now(), cacheFile = path.join(userConfigDir(), "tools.json"), probe = (t) => !!which(t) } = {}) {
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (now - c.checkedAt < CACHE_TTL_MS && Array.isArray(c.missing)) return c;
  } catch { /* 캐시 없음 */ }
  const missing = REQUIRED_TOOLS.filter((t) => !probe(t));
  const result = { checkedAt: now, missing };
  try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(result)); } catch { /* 쓰기 실패는 무시 */ }
  return result;
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const readFile = deps.readFile ?? ((p) => fs.readFileSync(p, "utf8"));
  const exists = deps.exists ?? ((p) => fs.existsSync(p));
  const toolStatus = deps.toolStatus ?? toolStatusCached;
  const parts = [];

  const hp = handoffPath(cwd);
  if (exists(hp)) {
    let body = "";
    try { body = readFile(hp); } catch { body = ""; }
    if (body.trim()) parts.push(`## Baton 재개\n이전 세션이 남긴 handoff입니다. 여기서 이어서 진행하고, 완료된 항목은 반복하지 마세요.\n\n${body.trim()}`);
  }

  const learn = (deps.learnings ?? (() => {
    const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
    return selectForInjection(readAll(cwd), cfg.learnings);
  }))();
  if (learn) parts.push(`## 이 프로젝트에서 배운 것\n${learn}`);

  if (input.source !== "compact") {
    const notes = [];
    if (!exists(path.join(cwd, ".codegraph"))) notes.push("codegraph 인덱스 없음 (`codegraph init`으로 생성 가능)");
    const status = toolStatus();
    if (status.missing?.length) notes.push(`미설치 도구: ${status.missing.join(", ")} → /nereus:setup`);
    const pending = (deps.pendingCandidates ?? ((c) => readCandidates(c).filter((x) => x.status === "open").length))(cwd);
    if (pending > 0) notes.push(`학습 후보 ${pending}건 검토 대기 → /nereus:learn review`);
    if (notes.length) parts.push(`## Nereus 상태\n- ${notes.join("\n- ")}`);
  }

  return parts.length ? contextPayload("SessionStart", parts.join("\n\n")) : null;
}

if (process.argv[1] && /session-start\.mjs$/.test(process.argv[1])) {
  emit(handle(readStdinJson()));
}
