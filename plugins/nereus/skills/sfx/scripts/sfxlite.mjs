// earshot-sfx-lite 어댑터 — 코드로 합성하는 효과음 252종 (numpy·scipy, 모델 없음).
// 상류가 생긴 지 얼마 안 돼 커밋을 고정한다. PyPI 의 `earshot` 은 다른 패키지다 — 쓰지 않는다.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const SFXLITE_REPO = "https://github.com/Dodai0419/earshot-sfx-lite";
export const SFXLITE_COMMIT = "c91a7c9d2690ae658f790859d4ad4004857903dd";

// 슬래시로 나뉜 소문자 경로만 받는다 — 인자 배열로 넘기지만 경로·옵션 주입을 입구에서 막는다.
const ID_RE = /^[a-z0-9_]+(\/[a-z0-9_]+)+$/;
const ROW_RE = /^(\S+)\s+([0-9.]+)\s+([0-9.]+)\s+([^|]+)\|/;

export function sfxliteHome(env = process.env) {
  return env.NEREUS_SFXLITE || join(env.HOME ?? "", ".local/share/nereus/sfx/earshot-sfx-lite");
}

export function sfxlitePython(home) {
  const venv = join(home, ".venv/bin/python");
  return existsSync(venv) ? venv : "python3";
}

export function parseList(stdout) {
  return String(stdout).split("\n").flatMap((line) => {
    const m = ROW_RE.exec(line);
    if (!m || !ID_RE.test(m[1])) return [];
    return [{ id: m[1], durSec: Number(m[2]), peakSec: Number(m[3]), kinds: m[4].split(",").map((k) => k.trim()).filter(Boolean) }];
  });
}

export function buildRenderArgs({ id, out, dur, apex, pitch, seed }) {
  if (!ID_RE.test(String(id))) throw new Error(`invalid sfxlite id: ${id}`);
  const knobs = [["--dur", dur], ["--apex", apex], ["--pitch", pitch], ["--seed", seed]]
    .filter(([, v]) => v !== undefined && v !== null)
    .flatMap(([k, v]) => [k, String(v)]);
  return ["-m", "sfxlite", "render", id, "-o", out, ...knobs];
}

export function parseRenderLine(stdout) {
  const line = String(stdout).split("\n").find((l) => l.startsWith("wrote "));
  if (!line) return null;
  const dur = /: ([0-9.]+) s, onset/.exec(line);
  const peak = /peak at ([0-9.]+) s/.exec(line);
  const checks = /checks: (\S+)/.exec(line);
  if (!dur || !peak) return null;
  return { durSec: Number(dur[1]), peakSec: Number(peak[1]), checks: checks?.[1] ?? "" };
}
