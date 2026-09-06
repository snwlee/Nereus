// 스킬 커버리지: 설치된 스킬이 실제 세션에서 발동했는가.
// 착안: Warp Skill Doctor 의 skill_coverage 지표(MIT). 파이썬 수집기 대신 Node 로 직접 트랜스크립트를 읽는다.
// "설치돼 있는데 한 번도 안 걸린 스킬 = description(트리거)이 문제" 라는 진단이 핵심이다.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Claude Code 는 cwd 의 구분자를 - 로 바꾼 이름으로 트랜스크립트 디렉터리를 만든다. */
export function slugifyCwd(cwd) {
  return String(cwd).replace(/[\\/:]/g, "-");
}

export function transcriptDir(cwd, home = os.homedir()) {
  return path.join(home, ".claude", "projects", slugifyCwd(cwd));
}

// 슬래시 커맨드(/nereus:setup)는 Skill 도구 호출로 기록되지 않고 command-name 태그로 남는다. 둘 다 세야 실제 사용량이 나온다.
const SLASH_RE = /<command-name>\s*\/?([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+)\s*<\/command-name>/g;

export function skillsUsed(jsonlText) {
  const out = new Set();
  for (const line of String(jsonlText ?? "").split("\n")) {
    for (const m of line.matchAll(SLASH_RE)) out.add(m[1]);
    if (!line.includes('"Skill"')) continue; // 값싼 사전 필터
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const content = o?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type === "tool_use" && b?.name === "Skill" && typeof b?.input?.skill === "string") out.add(b.input.skill);
    }
  }
  return out;
}

export function readSessions(cwd, { home = os.homedir(), limit = 20, readDir = fs.readdirSync, readFile = (p) => fs.readFileSync(p, "utf8"), stat = fs.statSync } = {}) {
  const dir = transcriptDir(cwd, home);
  let files;
  try { files = readDir(dir).filter((f) => f.endsWith(".jsonl")); } catch { return []; }
  const sorted = files
    .map((f) => { try { return { f, m: stat(path.join(dir, f)).mtimeMs }; } catch { return { f, m: 0 }; } })
    .sort((a, b) => b.m - a.m)
    .slice(0, limit);
  return sorted.map(({ f }) => {
    let text = "";
    try { text = readFile(path.join(dir, f)); } catch { /* 못 읽으면 빈 세션 */ }
    return { id: path.basename(f, ".jsonl"), skills: skillsUsed(text) };
  });
}

/** 플러그인의 skills/ 디렉터리에서 설치된 스킬 이름(<접두>:<이름>)을 만든다. */
export function listInstalledSkills(skillsDir, prefix = "nereus", { readDir = fs.readdirSync } = {}) {
  try {
    return readDir(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `${prefix}:${d.name}`)
      .sort();
  } catch { return []; }
}

export function coverageReport({ sessions, installed }) {
  const set = new Set(installed);
  const perSkill = new Map();
  let sessionsWithSkill = 0;
  for (const s of sessions) {
    const mine = [...s.skills].filter((k) => set.has(k));
    if (mine.length) sessionsWithSkill++;
    for (const k of mine) perSkill.set(k, (perSkill.get(k) ?? 0) + 1);
  }
  const used = [...perSkill.entries()].map(([name, sessionsCount]) => ({ name, sessions: sessionsCount })).sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  return {
    sessionsSampled: sessions.length,
    sessionsWithSkill,
    coverage: sessions.length ? sessionsWithSkill / sessions.length : 0,
    used,
    unused: installed.filter((k) => !perSkill.has(k)),
  };
}
