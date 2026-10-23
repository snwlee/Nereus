// SessionStart: 루프 서브세션에 직전 반복의 handoff 주입, codegraph 인덱스·외부 도구 상태 한 줄 요약.
// 대화형 세션에는 handoff 를 넣지 않는다 — 컨텍스트는 Claude Code 자동 압축(50%)이 맡는다.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { readStdinJson, contextPayload, emit } from "./lib/io.mjs";
import {
  handoffPath, handoffDir, sessionHandoffPath, latestHandoff,
  planHandoffPrune, userConfigDir,
} from "./lib/paths.mjs";
import { which } from "./lib/exec.mjs";
import { readAll, selectForInjection } from "./lib/learnings.mjs";
import { loadConfig } from "./lib/config.mjs";
import { readCandidates } from "./session-end.mjs";
import { skillMapBlock } from "./lib/router.mjs";
import { readInventory } from "./lib/plugin-inventory.mjs";
import { loadExtensions } from "./lib/extensions.mjs";
import { delegateRoutes } from "./lib/delegates.mjs";
import { detectHarness } from "./lib/harness.mjs";

// Baton 이 없어진 뒤 컨텍스트를 지키는 것은 자동 압축뿐이다. 기본값(약 83%)으로 두면 늦게 압축된다.
// 권장값 이하(더 일찍 압축)는 사용자가 정한 것이라 존중한다. Codex·OpenCode 는 ~/.claude/settings.json 을
// 읽지 않아 /nereus:setup 으로 끌 수 없고, 무인 루프 반복에는 소음이라 둘 다 알리지 않는다.
const AUTOCOMPACT_PCT = 50;
function autocompactNote(input, env) {
  if (env.NEREUS_LOOP || detectHarness(input) !== "claude") return null;
  const cur = Number(env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE);
  if (cur > 0 && cur <= AUTOCOMPACT_PCT) return null;
  const shown = env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE ? `${env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE}%` : "미설정(약 83%)";
  return `자동 압축 임계값 ${shown} — 권장 ${AUTOCOMPACT_PCT}% → /nereus:setup`;
}

// 루프 반복은 매번 새 `claude -p` 세션이다. 직전 반복이 남긴 handoff 가 유일한 상태다.
const LOOP_LEAD = "직전 반복이 남긴 handoff 입니다. 완료 항목은 반복하지 말고, MUST NOT 에 적힌 접근은 다시 시도하지 마세요.";

// agy 는 2026-09-12 부로 필수가 아니다 — gemini 2차 의견은 웹세션(python3)으로 받는다.
const REQUIRED_TOOLS = ["codegraph", "ooo", "ocr", "specify", "openspec", "typst", "python3", "codex"];
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
const ASK_POLICY =
  "순서·우선순위·착수 승인은 묻지 않는다. 할 일이 정해져 있으면 스스로 순서를 정해 하나씩 전부 끝낸다. "
  + "질문은 (a) 하네스가 알 수 없는 정보와 (b) 외부로 나가는·되돌리기 어려운 행동에만 쓴다.";

// 디렉터리가 없으면 빈 목록. 훅은 fail-open 이다.
function defaultEntries(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }));
  } catch { return []; }
}

function defaultRemoveFile(p) { fs.rmSync(p, { force: true }); }

// 반복마다 다른 파일에 쓴다. 한 파일을 공유하면 병렬 wave 의 "전체 재작성"이 서로를 지운다
// (.nereus 는 git 추적 밖이라 되돌릴 수도 없다).
// since: 루프 시작 시각. 그 전 파일(폐지 전 대화형 handoff·다른 루프)은 이번 루프의 상태가 아니다.
function loopHandoffBlock(input, { cwd, readFile, exists, now, entries, removeFile, since }) {
  const dir = handoffDir(cwd);
  const mine = sessionHandoffPath({ cwd, sessionId: input.session_id, now, entries });
  const current = since ? entries.filter((e) => e.mtimeMs >= since) : entries;
  const latest = latestHandoff({ cwd, entries: current, legacyExists: !since && exists(handoffPath(cwd)) });
  let body = "";
  if (latest) { try { body = readFile(latest); } catch { body = ""; } }
  const head = `이 세션의 handoff 파일: \`${path.relative(cwd, mine)}\` — handoff 는 여기에만 쓴다(다른 세션 파일을 덮어쓰지 않기 위해서다). 디렉터리가 없으면 만든다.`;
  // 정리는 주입 뒤에 조용히. 실패가 세션 시작을 막지 않는다.
  try {
    const protect = [path.basename(mine), latest ? path.basename(latest) : ""].filter(Boolean);
    for (const name of planHandoffPrune({ entries, now, protect })) removeFile(path.join(dir, name));
  } catch { /* 무시 */ }
  const lead = body.trim() ? `${LOOP_LEAD}\n\n${body.trim()}` : "직전 반복의 handoff 가 없습니다. 새로 시작합니다.";
  return `## 루프 handoff\n${lead}\n\n${head}`;
}

export function handle(input, deps = {}) {
  const cwd = input.cwd || process.cwd();
  const readFile = deps.readFile ?? ((p) => fs.readFileSync(p, "utf8"));
  const exists = deps.exists ?? ((p) => fs.existsSync(p));
  const toolStatus = deps.toolStatus ?? toolStatusCached;
  const parts = [];

  const env = deps.env ?? process.env;
  if (env.NEREUS_LOOP) parts.push(loopHandoffBlock(input, { cwd, readFile, exists, now: (deps.now ?? (() => Date.now()))(), entries: (deps.entries ?? defaultEntries)(handoffDir(cwd)), removeFile: deps.removeFile ?? defaultRemoveFile, since: Number(env.NEREUS_LOOP_SINCE) || 0 }));

  const learn = (deps.learnings ?? (() => {
    const cfg = (deps.config ?? (() => loadConfig({ cwd })))();
    return selectForInjection(readAll(cwd), cfg.learnings);
  }))();
  if (learn) parts.push(`## 이 프로젝트에서 배운 것\n${learn}`);

  // 스킬 맵: 압축된 description 만으로는 모델이 스킬을 떠올리지 못한다. 새 컨텍스트마다 한 번 심는다.
  // compact 는 대화가 이어지므로 다시 넣지 않는다.
  if (input.source !== "compact") {
    parts.push(`## 작업 방식\n${ASK_POLICY}`);
    parts.push(skillMapBlock({ extraRoutes: [
      ...(deps.extensions ?? (() => loadExtensions()))().routes,
      ...(deps.delegates ?? (() => delegateRoutes()))(),
    ] }));
  }

  if (input.source !== "compact") {
    const notes = [];
    if (!exists(path.join(cwd, ".codegraph"))) notes.push("codegraph 인덱스 없음 (`codegraph init`으로 생성 가능)");
    const status = toolStatus();
    if (status.missing?.length) notes.push(`미설치 도구: ${status.missing.join(", ")} → /nereus:setup`);
    const pending = (deps.pendingCandidates ?? ((c) => readCandidates(c).filter((x) => x.status === "open").length))(cwd);
    const compactNote = autocompactNote(input, env);
    if (compactNote) notes.push(compactNote);
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
