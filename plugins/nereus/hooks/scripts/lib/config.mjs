// 설정 로더. 기본값 ← 사용자 전역 ← 프로젝트 순으로 깊은 병합. 입력은 변경하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { userConfigDir, projectStateDir } from "./paths.mjs";

export const DEFAULTS = Object.freeze({
  secondOpinion: "both", // "both" | "codex" | "gemini" | "none" | ["ocr","gemini"] 같은 배열
  tdd: { exclude: ["**/migrations/**", "**/*.config.*", "**/*.d.ts", "**/generated/**", "**/*.g.dart", "**/*.freezed.dart"] },
  pdf: { engine: "typst", font: "Noto Sans KR" },
  image: { backend: "auto" }, // auto | web | api
  commitQuality: { block: ["secret", "env_file"], warn: ["debug_log"], exclude: [], maxReport: 8 }, // 안전 문제만 차단, 스타일은 경고
  learnings: { minConfidence: 0.7, limit: 8, maxChars: 900 }, // SessionStart 주입 예산 (토큰 절약)
  gate: { exclude: [] }, // 완료 무결성 검사에서 제외할 파일 glob (예: 분류기 자체, 픽스처)
  design: { enforce: "block", exclude: [], widths: [320, 768, 1440], systemGenerator: "ui-ux-pro-max" }, // 디자인 표면 변경은 Gemini 피드백 라운드 없이는 finish 게이트를 통과하지 못한다. systemGenerator: "none" 이면 방향 생성(0단계)을 건너뛴다
  loop: { extraAllowedTools: [] }, // 루프 서브세션에 추가로 허용할 Bash 패턴. 환경별 프록시(예: "Bash(rtk:*)")를 여기서 더한다. push·권한 상승은 더해도 걸러진다
  videoGate: { enforce: "block", freshMinutes: 20 }, // 유료 영상·이미지 생성: OpenMontage 밖 배치 스크립트는 차단, 모든 유료 호출은 .nereus/budget.json 예산(사이트 잔액 기준) 안에서만. "warn" | "off" 로 완화
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
