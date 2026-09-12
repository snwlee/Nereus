// SessionStart: handoff.md 주입, codegraph 인덱스·외부 도구 상태 한 줄 요약.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import {
  handoffPath, handoffDir, sessionHandoffPath, latestHandoff,
  recentOtherSessions, planHandoffPrune, userConfigDir,
} from "./lib/paths.mjs";
import { which } from "./lib/exec.mjs";
import { readAll, selectForInjection } from "./lib/learnings.mjs";
import { loadConfig } from "./lib/config.mjs";
import { readCandidates } from "./session-end.mjs";
import { skillMapBlock } from "./lib/router.mjs";
import { readInventory } from "./lib/plugin-inventory.mjs";
import { loadExtensions } from "./lib/extensions.mjs";

// /clear 직후 주입되는 재개 절차. resume 스킬이 하던 검증을 여기서 지시해
// 사용자가 /nereus:resume 을 따로 칠 필요를 없앤다. compact 는 대화가 그대로
// 이어지므로 이 체크리스트를 붙이지 않는다(이미 검증된 상태에서 요약만 된 것).
export const RESUME_CHECKLIST = [
  "`/nereus:resume` 을 따로 칠 필요 없이 지금 바로 이어서 진행하세요. 이어가기 전에:",
  "1. \"테스트 상태\"에 적힌 러너를 실제로 실행해 handoff 의 주장과 대조한다. 다르면 handoff 가 아니라 현재 코드가 진실이다. 차이를 사용자에게 알린다.",
  "2. `git log --oneline -5` 와 `git status` 로 미커밋 변경을 확인한다.",
  "3. \"열린 질문\"이 있으면 작업을 시작하기 전에 사용자에게 먼저 묻는다.",
  "4. \"MUST NOT\"에 적힌 접근은 다시 시도하지 않는다. \"완료\" 항목은 반복하지 않는다.",
].join("\n");

// agy 는 2026-09-12 부로 필수가 아니다 — gemini 2차 의견은 웹세션(python3)으로 받는다.
export const REQUIRED_TOOLS = ["codegraph", "ooo", "ocr", "specify", "openspec", "typst", "python3", "codex"];
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

// 스냅샷 기본 경로·읽기·쓰기. 전부 deps 로 갈아끼울 수 있어야 테스트가 홈 디렉터리를 건드리지 않는다.
const snapshotFile = () => path.join(userConfigDir(), "plugin-snapshot.json");

function defaultPluginRecords() {
  const home = os.homedir();
  return readInventory({
    pluginsFile: path.join(home, ".claude", "plugins", "installed_plugins.json"),
    settingsFile: path.join(home, ".claude", "settings.json"),
  });
}

function defaultReadSnapshot() {
  try {
    const v = JSON.parse(fs.readFileSync(snapshotFile(), "utf8"));
    return Array.isArray(v) ? v : null;
  } catch {
    return null; // 파일이 없으면 기준선이 없다는 뜻이고, 그때는 조용히 기준선만 남긴다.
  }
}

function defaultWriteSnapshot(snapshot) {
  try {
    fs.mkdirSync(path.dirname(snapshotFile()), { recursive: true });
    fs.writeFileSync(snapshotFile(), JSON.stringify(snapshot));
  } catch { /* 무시 */ }
}

/**
 * 활성 플러그인 집합을 지난 스냅샷과 대조해 "새로 생긴 것"만 알린다.
 *
 * 첫 실행은 **조용하다**. 기준선이 없는 상태에서 알리면 설치돼 있던 플러그인 전부가 새것으로
 * 보고돼 첫 세션이 소음으로 시작한다. 기준선만 남기고 다음 실행부터 차이를 말한다.
 *
 * 비활성 플러그인은 세지 않는다 — 꺼둔 플러그인은 아무것도 가리지 못한다(plugin-inventory 와 같은 규칙).
 *
 * @param {{records: Array<{name: string, enabled: boolean}>, previous: string[]|null}} o
 * @returns {{note: string|null, snapshot: string[]}}
 */
export function pluginSnapshotNote({ records, previous }) {
  const snapshot = (records ?? []).filter((r) => r?.enabled === true).map((r) => r.name);
  if (!previous) return { note: null, snapshot };

  const known = new Set(previous);
  const added = snapshot.filter((name) => !known.has(name));
  if (!added.length) return { note: null, snapshot };

  return {
    note: `새 플러그인 ${added.length}개: ${added.join(", ")} → 충돌 점검은 /nereus:doctor`,
    snapshot,
  };
}

// 스킬 문서에만 두면 그 스킬을 부르지 않은 턴에는 적용되지 않는다. 매 컨텍스트에 한 줄 심는다.
export const ASK_POLICY =
  "순서·우선순위·착수 승인은 묻지 않는다. 할 일이 정해져 있으면 스스로 순서를 정해 하나씩 전부 끝낸다. "
  + "질문은 (a) 하네스가 알 수 없는 정보와 (b) 외부로 나가는·되돌리기 어려운 행동에만 쓴다.";

const COMPACT_LEAD = "이전 세션이 남긴 handoff입니다. 여기서 이어서 진행하고, 완료된 항목은 반복하지 마세요.";

// 디렉터리가 없으면 빈 목록. 훅은 fail-open 이다.
function defaultEntries(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }));
  } catch { return []; }
}

function defaultRemoveFile(p) { fs.rmSync(p, { force: true }); }

function readFileSafe(p, readFile) {
  try { return readFile(p); } catch { return ""; }
}

/** 경고 줄에 붙일 한 줄 요약. "## 목표" 다음 첫 내용 줄을 40자로 자른다. */
function firstGoalLine(text) {
  const lines = String(text).split("\n");
  const at = lines.findIndex((l) => l.trim().startsWith("## 목표"));
  if (at === -1) return "(목표 미상)";
  const rest = lines.slice(at + 1).find((l) => l.trim());
  return rest ? rest.trim().slice(0, 40) : "(목표 미상)";
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const readFile = deps.readFile ?? ((p) => fs.readFileSync(p, "utf8"));
  const exists = deps.exists ?? ((p) => fs.existsSync(p));
  const toolStatus = deps.toolStatus ?? toolStatusCached;
  const parts = [];

  // 세션마다 다른 파일에 쓴다. 한 파일을 공유하면 두 번째 세션의 "전체 재작성"이
  // 첫 세션 상태를 통째로 지운다(.nereus 는 git 추적 밖이라 되돌릴 수도 없다).
  const now = (deps.now ?? (() => Date.now()))();
  const env = deps.env ?? process.env;
  const dir = handoffDir(cwd);
  const entries = (deps.entries ?? defaultEntries)(dir);
  const mine = sessionHandoffPath({ cwd, sessionId: input.session_id, now, entries });
  const latest = latestHandoff({ cwd, entries, legacyExists: exists(handoffPath(cwd)) });

  let body = "";
  if (latest) { try { body = readFile(latest); } catch { body = ""; } }
  const lead = input.source === "compact" ? COMPACT_LEAD : RESUME_CHECKLIST;
  const head = `이 세션의 handoff 파일: \`${path.relative(cwd, mine)}\` — handoff 는 여기에만 쓴다(다른 세션 파일을 덮어쓰지 않기 위해서다). 디렉터리가 없으면 만든다.`;
  // 루프 서브세션은 반복마다 새 세션이라 자기 직전 반복이 매번 경고로 잡힌다. 소음이다.
  const warn = env.NEREUS_LOOP ? [] : recentOtherSessions({ entries, sessionId: input.session_id, now })
    .map((e) => `- \`${e.name}\` — ${firstGoalLine(readFileSafe(path.join(dir, e.name), readFile))}`);
  // compact 는 같은 대화가 이어지는 것이라 새 컨텍스트가 아니다. 넣을 본문이 없으면
  // 경로 안내도 다시 내지 않는다 — 세션 시작 때 이미 알렸다.
  const silent = input.source === "compact" && !body.trim();
  const block = silent ? [] : [body.trim() ? `${lead}\n\n${body.trim()}` : "재개할 handoff 가 없습니다. 새로 시작합니다.", head]
    .concat(warn.length ? [`⚠ 다른 세션이 최근 30분 안에 handoff 를 갱신했습니다. 같은 파일을 건드리는지 확인하세요:\n${warn.join("\n")}`] : []);
  if (block.length) parts.push(`## Baton 재개\n${block.join("\n\n")}`);

  // 정리는 주입 뒤에 조용히. 실패가 세션 시작을 막지 않는다.
  try {
    const protect = [path.basename(mine), latest ? path.basename(latest) : ""].filter(Boolean);
    for (const name of planHandoffPrune({ entries, now, protect })) (deps.removeFile ?? defaultRemoveFile)(path.join(dir, name));
  } catch { /* 무시 */ }

  const learn = (deps.learnings ?? (() => {
    const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
    return selectForInjection(readAll(cwd), cfg.learnings);
  }))();
  if (learn) parts.push(`## 이 프로젝트에서 배운 것\n${learn}`);

  // 스킬 맵: 압축된 description 만으로는 모델이 스킬을 떠올리지 못한다. 새 컨텍스트마다 한 번 심는다.
  // compact 는 대화가 이어지므로 다시 넣지 않는다.
  if (input.source !== "compact") {
    parts.push(`## 작업 방식\n${ASK_POLICY}`);
    parts.push(skillMapBlock({ extraRoutes: (deps.extensions ?? (() => loadExtensions()))().routes }));
  }

  if (input.source !== "compact") {
    const notes = [];
    if (!exists(path.join(cwd, ".codegraph"))) notes.push("codegraph 인덱스 없음 (`codegraph init`으로 생성 가능)");
    const status = toolStatus();
    if (status.missing?.length) notes.push(`미설치 도구: ${status.missing.join(", ")} → /nereus:setup`);
    const pending = (deps.pendingCandidates ?? ((c) => readCandidates(c).filter((x) => x.status === "open").length))(cwd);
    if (pending > 0) notes.push(`학습 후보 ${pending}건 검토 대기 → /nereus:learn review`);
    // 플러그인 스냅샷. compact 는 이 블록 안이라 자동으로 제외된다 — 대화가 이어지는 중에
    // 알림을 다시 내면 소음이고, 스냅샷을 갱신하면 "새것" 판정 기준선이 흔들린다.
    // 읽기·쓰기 실패는 삼킨다. 알림 하나 때문에 세션 시작이 깨지면 안 된다.
    try {
      const records = (deps.pluginRecords ?? defaultPluginRecords)();
      const previous = (deps.readSnapshot ?? defaultReadSnapshot)();
      const { note, snapshot } = pluginSnapshotNote({ records, previous });
      (deps.writeSnapshot ?? defaultWriteSnapshot)(snapshot);
      if (note) notes.push(note);
    } catch { /* 무시 */ }
    if (notes.length) parts.push(`## Nereus 상태\n- ${notes.join("\n- ")}`);
  }

  return parts.length ? contextPayload("SessionStart", parts.join("\n\n")) : null;
}

if (process.argv[1] && /session-start\.mjs$/.test(process.argv[1])) {
  emit(handle(readStdinJson()));
}
