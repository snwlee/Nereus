// 설정·상태 경로. 플랫폼 분기는 여기서만 한다.
import path from "node:path";
import os from "node:os";

const APP = "nereus";

export function userConfigDir(opts = {}) {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  const home = opts.home ?? os.homedir();
  if (env.NEREUS_HOME) return env.NEREUS_HOME;
  if (platform === "win32") {
    const base = env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(base, APP);
  }
  return path.join(home, ".config", APP);
}

export function projectStateDir(cwd) {
  return path.join(cwd, ".nereus");
}

export function handoffPath(cwd) {
  return path.join(projectStateDir(cwd), "handoff.md");
}

// ── 세션별 handoff ────────────────────────────────────────────────────────────
// 같은 프로젝트에서 세션이 여러 개면 한 파일을 서로 전체 재작성하며 덮어썼다.
// 쓰기는 자기 세션 파일, 읽기는 최신 파일로 나눈다. handoffPath 는 레거시 폴백으로 남는다.

export function handoffDir(cwd) {
  return path.join(projectStateDir(cwd), "handoff");
}

const sid8 = (sessionId) => String(sessionId || "nosession").slice(0, 8);

/** 파일명의 시각은 세션 **시작** 시각이다. 최신 판정에는 쓰지 않는다(mtime 을 쓴다). */
export function handoffFileName({ now = Date.now(), sessionId } = {}) {
  const d = new Date(now);
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
  return `${stamp}-${sid8(sessionId)}.md`;
}

/**
 * 이 세션이 쓸 경로. compact 는 같은 세션이므로 같은 sid8 파일이 있으면 그것을 재사용한다.
 * 없으면 새 이름을 만든다. 부수 효과 없음 — 파일을 만들지 않는다.
 */
export function sessionHandoffPath({ cwd, sessionId, now = Date.now(), entries = [] } = {}) {
  const mine = entries.find((e) => e.name.endsWith(`-${sid8(sessionId)}.md`));
  return path.join(handoffDir(cwd), mine ? mine.name : handoffFileName({ now, sessionId }));
}
