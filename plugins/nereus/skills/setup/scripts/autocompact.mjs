// Claude Code 자동 압축 임계값(CLAUDE_AUTOCOMPACT_PCT_OVERRIDE)을 읽고 설정한다.
// Baton 하드 스톱보다 뒤에 있어야 안전망 역할을 한다. Claude Code 내부 상한은 약 83%.
// 사용: node autocompact.mjs            현재 값 출력
//       node autocompact.mjs --set 80   설정(변경 전 백업)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const KEY = "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE";
export const MAX_PCT = 83; // Claude Code 가 내부적으로 이 위를 잘라낸다

export function settingsPath(home = os.homedir()) {
  return path.join(home, ".claude", "settings.json");
}

/** 설정 객체에 임계값을 반영한 새 객체를 돌려준다. 입력은 변경하지 않는다. */
export function applyAutocompact(settings, pct) {
  const n = Number(pct);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error(`1~100 사이 정수여야 합니다: ${pct}`);
  const effective = Math.min(n, MAX_PCT);
  return { settings: { ...settings, env: { ...(settings.env ?? {}), [KEY]: String(effective) } }, effective, clamped: effective !== n };
}

export function readCurrent(file = settingsPath(), readFile = (p) => fs.readFileSync(p, "utf8")) {
  try {
    const v = JSON.parse(readFile(file))?.env?.[KEY];
    return v === undefined ? null : Number(v);
  } catch { return null; }
}

if (process.argv[1] && /autocompact\.mjs$/.test(process.argv[1])) {
  const file = settingsPath();
  const i = process.argv.indexOf("--set");
  if (i === -1) {
    const cur = readCurrent(file);
    console.log(cur === null ? `${KEY}: 미설정 (Claude Code 기본값 사용, 약 ${MAX_PCT}%)` : `${KEY}: ${cur}%`);
    process.exit(0);
  }
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* 새로 만든다 */ }
  const { settings: next, effective, clamped } = applyAutocompact(settings, process.argv[i + 1]);
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-${Date.now()}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log(`${KEY} = ${effective}%${clamped ? ` (요청값이 상한 ${MAX_PCT}% 로 조정됨)` : ""} → ${file}`);
  console.log("새 세션부터 적용됩니다.");
}
