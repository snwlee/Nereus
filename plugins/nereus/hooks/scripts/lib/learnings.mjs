// 세션 학습. 교정·실패·선호를 규칙으로 남기고 다음 세션에 신뢰도 높은 것만 예산 안에서 주입한다.
// 저장소: 프로젝트 .nereus/learnings.jsonl, 전역 <설정 디렉터리>/learnings.jsonl (한 줄에 한 규칙)
import fs from "node:fs";
import path from "node:path";
import { userConfigDir, projectStateDir } from "./paths.mjs";

export const START_CONFIDENCE = 0.5;
export const BUMP = 0.2;

export function learningsPath(cwd, scope = "project") {
  return scope === "global" ? path.join(userConfigDir(), "learnings.jsonl") : path.join(projectStateDir(cwd), "learnings.jsonl");
}

export function parseLearnings(jsonl) {
  const out = [];
  for (const line of String(jsonl ?? "").split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e.rule === "string" && e.rule.trim()) out.push(e);
    } catch { /* 깨진 줄은 버린다 */ }
  }
  return out;
}

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");

/** 같은 규칙이 다시 확인되면 신뢰도를 올린다. 입력 배열은 변경하지 않는다. */
export function addLearning(entries, { trigger, rule, source = "correction", scope = "project" }, { now = Date.now() } = {}) {
  const key = norm(rule);
  const idx = entries.findIndex((e) => norm(e.rule) === key);
  if (idx === -1) return [...entries, { trigger, rule, source, scope, confidence: START_CONFIDENCE, hits: 1, at: now }];
  const prev = entries[idx];
  const next = { ...prev, trigger: trigger || prev.trigger, hits: (prev.hits ?? 1) + 1, confidence: Math.min(1, Number(((prev.confidence ?? START_CONFIDENCE) + BUMP).toFixed(4))), at: now };
  return entries.map((e, i) => (i === idx ? next : e));
}

export function selectForInjection(entries, { minConfidence = 0.7, limit = 8, maxChars = 900 } = {}) {
  const picked = entries
    .filter((e) => (e.confidence ?? 0) >= minConfidence)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, limit);
  const lines = [];
  let used = 0;
  for (const e of picked) {
    const line = `- ${e.trigger ? `${e.trigger}: ` : ""}${e.rule}`;
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

export function readAll(cwd, { readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  const read = (p) => { try { return parseLearnings(readFile(p)); } catch { return []; } };
  return [...read(learningsPath(cwd, "global")), ...read(cwd ? learningsPath(cwd, "project") : "")];
}

export function append(cwd, entry, scope = "project") {
  const file = learningsPath(cwd, scope);
  const existing = (() => { try { return parseLearnings(fs.readFileSync(file, "utf8")); } catch { return []; } })();
  const next = addLearning(existing, { ...entry, scope });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next.map((e) => JSON.stringify(e)).join("\n") + "\n");
  return next;
}

// 사용자가 방금 한 말이 교정인지. 훅에서 값싸게 판정한다(LLM 호출 없음).
const CORRECTION_RE = [
  /(^|\s)아니(야|요|라|다|\s|,|\.|$)/,
  /그게\s*아니/, /틀렸/, /잘못\s*(됐|했|이)/, /다시\s*해/, /하지\s*마/, /말고/, /반대로/,
  /\bno,\s/i, /\bnot\s+(what|like)\b/i, /\bactually\b/i, /\bdon'?t\b/i, /\bwrong\b/i, /\binstead\b/i, /\brevert\b/i,
];
export function isCorrection(prompt) {
  const p = String(prompt ?? "");
  if (!p.trim()) return false;
  return CORRECTION_RE.some((re) => re.test(p));
}
