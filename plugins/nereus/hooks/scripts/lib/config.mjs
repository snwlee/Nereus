// 설정 로더. 기본값 ← 사용자 전역 ← 프로젝트 순으로 깊은 병합. 입력은 변경하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { userConfigDir, projectStateDir } from "./paths.mjs";

export const DEFAULTS = Object.freeze({
  secondOpinion: "both", // "both" | "codex" | "gemini" | "none" | ["ocr","gemini"] 같은 배열
  baton: { warn: 0.5, hard: 0.7 }, // Claude Code 자동 압축(기본 약 83%, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE) 보다 앞서야 의미가 있다
  tdd: { exclude: ["**/migrations/**", "**/*.config.*", "**/*.d.ts", "**/generated/**", "**/*.g.dart", "**/*.freezed.dart"] },
  pdf: { engine: "typst", font: "Noto Sans KR" },
  image: { backend: "auto" }, // auto | web | api
  commitQuality: { block: ["secret", "env_file"], warn: ["debug_log"], exclude: [], maxReport: 8 }, // 안전 문제만 차단, 스타일은 경고
  learnings: { minConfidence: 0.7, limit: 8, maxChars: 900 }, // SessionStart 주입 예산 (토큰 절약)
  gate: { exclude: [] }, // 완료 무결성 검사에서 제외할 파일 glob (예: 분류기 자체, 픽스처)
  autoClear: { enabled: true, prompt: "이어서 진행해" }, // handoff 뒤 /clear·재개를 자동 입력 (Orca 터미널 안에서만 동작)
});

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    out[k] = isPlain(v) && isPlain(base?.[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function mergeConfig(defaults, ...layers) {
  return layers.reduce((acc, layer) => deepMerge(acc, layer), deepMerge({}, defaults));
}

function readJson(readFile, file) {
  try {
    return JSON.parse(readFile(file));
  } catch {
    return {};
  }
}

export function loadConfig({ cwd = process.cwd(), userDir = userConfigDir(), projectDir = projectStateDir(cwd), readFile = (p) => fs.readFileSync(p, "utf8") } = {}) {
  const user = readJson(readFile, path.join(userDir, "config.json"));
  const project = readJson(readFile, path.join(projectDir, "config.json"));
  return mergeConfig(DEFAULTS, user, project);
}
