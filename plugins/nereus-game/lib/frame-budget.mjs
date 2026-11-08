// 프레임 예산 검사기. "빨라졌을 것"은 판정이 아니다 — 목표 FPS 와 측정 표본으로 수치를 낸다.
//
// 방법론은 awesome-gamedev-agent-skills 의 disciplines/performance-optimization(profiling-and-budgets.md)에서
// 왔다 — Copyright 2026 Abhishek Barali and contributors, Apache-2.0. 판정 함수로 다시 썼다.
// 렌더 예산(드로우 콜·GPU 메모리)은 nereus-3d:renderbudget 이 갖는다. 여기는 프레임 시간만 본다.
import { readCliInput, runCli } from "./cli-input.mjs";

const HITCH_FACTOR = 2;
const MAX_HITCH_RATE = 0.01;
const THERMAL_RATIO = 1.2;
const BOUND_MARGIN = 1.1;
const EVIDENCE_BUILDS = new Set(["release", "development"]);

const percentile = (sorted, p) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function boundSide(cpuMs, gpuMs) {
  if (!Number.isFinite(cpuMs) || !Number.isFinite(gpuMs)) return "unknown";
  if (gpuMs > cpuMs * BOUND_MARGIN) return "gpu";
  if (cpuMs > gpuMs * BOUND_MARGIN) return "cpu";
  return "both";
}

/** 표본 앞 1/4 과 뒤 1/4 의 평균. 몇 분 뒤 느려지는 것은 발열 스로틀링이다. */
function thermalDrop(samples, budgetMs) {
  const q = Math.floor(samples.length / 4);
  if (q < 1) return null;
  const first = mean(samples.slice(0, q));
  const last = mean(samples.slice(-q));
  return last > first * THERMAL_RATIO && last > budgetMs ? { first, last } : null;
}

export function checkFrames({ targetFps, samplesMs, build, device, cpuMs, gpuMs, gcBytesPerFrame } = {}) {
  if (!(targetFps > 0)) throw new Error(`targetFps 는 양수여야 한다: ${targetFps}`);
  if (!Array.isArray(samplesMs) || samplesMs.length === 0) throw new Error("프레임 시간 표본(samplesMs)이 없다");
  // 숫자가 아닌 표본이 섞이면 정렬·백분위가 깨진 채 판정한다(리뷰 R1).
  if (!samplesMs.every((s) => typeof s === "number" && Number.isFinite(s) && s >= 0)) {
    throw new Error("samplesMs 는 0 이상의 유한한 숫자(ms)만 담아야 한다");
  }

  const budgetMs = 1000 / targetFps;
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  const violations = [];

  if (p95 > budgetMs) violations.push({ code: "over-budget", p95, budgetMs, why: "p95 가 예산을 넘으면 스무 프레임에 한 번 목표를 놓친다" });
  const hitches = samplesMs.filter((s) => s > budgetMs * HITCH_FACTOR).length;
  if (hitches / samplesMs.length > MAX_HITCH_RATE) {
    violations.push({ code: "hitch-rate", hitches, rate: hitches / samplesMs.length, why: "평균이 좋아도 예산 2배 넘는 프레임은 끊김으로 보인다" });
  }
  const thermal = thermalDrop(samplesMs, budgetMs);
  if (thermal) violations.push({ code: "thermal-drop", ...thermal, why: "처음엔 맞다가 후반에 느려지면 발열이다. 프레임 상한과 여유를 둔다" });
  if (Number(gcBytesPerFrame) > 0) {
    violations.push({ code: "gc-per-frame", gcBytesPerFrame, why: "정상 상태에서 프레임마다 할당하면 GC 가 주기적으로 한 프레임을 멈춘다" });
  }

  // 에디터·디버그 빌드나 개발 기기 측정은 숫자가 거짓말을 한다. 위반이 없어도 통과로 내지 않는다.
  const evidence = EVIDENCE_BUILDS.has(build) && device === "target";
  return { budgetMs, p50, p95, p99, bound: boundSide(cpuMs, gpuMs), evidence, pass: evidence && violations.length === 0, violations };
}

// 실행 진입점. stdin 으로 checkFrames 입력을 받아 결과를 JSON 으로 낸다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(checkFrames(readCliInput())) + "\n");
  });
}
