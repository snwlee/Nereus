// 증분·방치형 경제 수식과 페이싱 판정.
//
// 수식은 awesome-gamedev-agent-skills 의 roblox-simulator-economy(economy_math.luau, formulas.md)에서
// 왔다 — Copyright 2026 Abhishek Barali and contributors, Apache-2.0. 엔진 중립 JS 로 다시 썼고
// 판정(checkPacing)은 이쪽에서 더했다. 원본 Luau 는 skills/roblox/templates/ 에 그대로 있다.
//
// 시뮬레이터(balance-sim)는 병목·절벽을 본다. 타이쿤이 실제로 죽는 곳은 그 사이다 —
// "환생 6이 몇 주 걸린다", "레벨 50 가격이 레벨 0 의 6억 배다", "오프라인이 며칠치를 준다".
// 셋 다 수입 없이도 설정만으로 계산된다.
import { readCliInput, runCli } from "./cli-input.mjs";
import { loadProfile } from "./profiles.mjs";

const SUFFIXES = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
  "Ud", "Dd", "Td", "Qad", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg"];
const RATIO_EPSILON = 1e-9;
const DEFAULT_HORIZON = 8;

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

export function levelCost(base, growth, level) {
  return Math.floor(base * growth ** level);
}

/** 실제(바닥 처리된) 가격을 걸으며 살 수 있는 만큼. 로그 공식은 바닥 처리 때문에 하나씩 어긋난다. */
export function maxAffordable({ base, growth, owned, balance, maxLevel }) {
  // 가격 0 이면 상한 없는 루프가 서버를 멈춘다. 조용히 maxLevel 까지 주지 않고 잘못된 설정으로 던진다.
  if (!(base >= 1)) throw new Error(`baseCost 는 1 이상이어야 한다: ${base}`);
  if (!Number.isFinite(maxLevel)) throw new Error(`maxLevel 은 유한해야 한다: ${maxLevel}`);
  let levels = 0;
  let cost = 0;
  for (let lv = owned; lv < maxLevel; lv++) {
    const price = levelCost(base, growth, lv);
    if (cost + price > balance) break;
    cost += price;
    levels++;
  }
  return { levels, cost };
}

function rebirthMultiplier(rebirth, k) {
  if (isFiniteNumber(rebirth.multiplierGrowth)) return rebirth.multiplierGrowth ** k;
  return 1 + k * rebirth.multiplierPerRebirth;
}

/**
 * 연속 환생 대기 비율 T_{k+1}/T_k = r·m_k/m_{k+1}. 수입이 약분되므로 수입 없이 판정한다.
 * 가산 배율이면 r/(1+p) 에서 시작해 r 로 수렴하고, 곱셈 배율이면 r/q 로 일정하다.
 */
export function rebirthWaitRatios(rebirth, count) {
  const ratios = [];
  for (let k = 0; k < count - 1; k++) {
    ratios.push((rebirth.requirementGrowth * rebirthMultiplier(rebirth, k)) / rebirthMultiplier(rebirth, k + 1));
  }
  return ratios;
}

/** 서버 시계 기준 자리 비운 시간. 0 이하나 NaN(시계 역행·깨진 타임스탬프)은 0 을 준다. */
export function offlineEarnings({ secondsAway, perSecond, maxHours, efficiency }) {
  if (!isFiniteNumber(secondsAway) || secondsAway <= 0) return 0;
  return Math.floor(Math.min(secondsAway, maxHours * 3600) * perSecond * efficiency);
}

/** 반올림을 먼저 하고 접미사를 고른다. 거꾸로 하면 999950 이 "1000.0K" 가 된다. */
export function formatNumber(value, decimals = 1) {
  if (!isFiniteNumber(value)) return String(value);
  if (value < 0) return `-${formatNumber(-value, decimals)}`;
  if (value < 1000) return String(Math.floor(value));
  const scale = 10 ** decimals;
  let tier = Math.floor(Math.log10(value) / 3);
  let mantissa = Math.round((value / 1000 ** tier) * scale) / scale;
  if (mantissa >= 1000) { mantissa /= 1000; tier++; }
  if (tier > SUFFIXES.length) return `${mantissa.toFixed(decimals)}e${tier * 3}`;
  return `${mantissa.toFixed(decimals)}${SUFFIXES[tier - 1]}`;
}

/**
 * 숫자가 아닌 필드는 NaN 비교가 전부 false 라 위반 0 으로 통과한다. 잘못된 호출로 던진다.
 * (리뷰 R1 — 빠진 requirementGrowth 가 초록으로 나왔다.)
 */
function requireNumbers(section, obj, keys) {
  const bad = keys.filter((k) => !isFiniteNumber(obj?.[k]));
  if (bad.length) throw new Error(`${section} 의 ${bad.join(", ")} 가 숫자가 아니다`);
}

function validateConfig(config) {
  for (const u of Array.isArray(config.upgrades) ? config.upgrades : []) {
    requireNumbers(`upgrade ${u?.id ?? "?"}`, u, ["baseCost", "costGrowth", "maxLevel"]);
  }
  if (config.rebirth) {
    const mult = isFiniteNumber(config.rebirth.multiplierGrowth) ? "multiplierGrowth" : "multiplierPerRebirth";
    requireNumbers("rebirth", config.rebirth, ["requirementGrowth", mult]);
  }
  if (config.offline) requireNumbers("offline", config.offline, ["maxHours", "efficiency"]);
}

const outside = (v, [lo, hi]) => v < lo - RATIO_EPSILON || v > hi + RATIO_EPSILON;

function checkUpgrades(upgrades, pacing) {
  const violations = [];
  for (const u of upgrades) {
    if (!(u.baseCost >= 1)) {
      violations.push({ code: "free-upgrade", id: u.id, why: "가격이 1 미만이면 buy max 루프가 멈추지 않는다" });
      continue;
    }
    if (u.maxLevel >= pacing.manyLevels && u.costGrowth > pacing.maxGrowthForManyLevels) {
      violations.push({
        code: "steep-growth", id: u.id, costGrowth: u.costGrowth, priceRatioAtMax: u.costGrowth ** u.maxLevel,
        why: `여러 번 사는 업그레이드는 ${pacing.maxGrowthForManyLevels} 이하여야 수입이 가격을 따라간다`,
      });
    }
  }
  return violations;
}

function checkRebirth(rebirth, pacing) {
  const ratios = rebirthWaitRatios(rebirth, pacing.rebirthHorizon ?? DEFAULT_HORIZON);
  const violations = ratios.flatMap((ratio, k) => (outside(ratio, pacing.rebirthWaitRatio)
    ? [{ code: "rebirth-ratio", rebirth: k + 2, ratio, range: pacing.rebirthWaitRatio,
      why: "환생 대기는 직전보다 조금만 길어야 한다. 넘으면 몇 번째 환생에서 몇 주가 된다" }]
    : []));
  return { ratios, violations };
}

function checkOffline(offline, pacing) {
  const violations = [];
  if (outside(offline.efficiency, pacing.offlineEfficiency)) {
    violations.push({ code: "offline-efficiency", efficiency: offline.efficiency, range: pacing.offlineEfficiency,
      why: "효율이 높으면 켜두는 것보다 끄는 게 낫고, 0 이면 로그아웃한 사람을 버린다" });
  }
  if (outside(offline.maxHours, pacing.offlineMaxHours)) {
    violations.push({ code: "offline-cap", maxHours: offline.maxHours, range: pacing.offlineMaxHours,
      why: "상한이 없거나 길면 깨진 타임스탬프 하나가 며칠치 수입을 준다" });
  }
  return violations;
}

/**
 * 장르 프로파일의 pacing 기준으로 설정을 판정한다.
 * 설정에 없는 축은 통과가 아니라 unmeasured 다 — 재지 않은 것을 초록으로 읽지 않는다.
 */
export function checkPacing({ profile, config = {} } = {}) {
  const pacing = profile?.pacing;
  if (!pacing || typeof pacing !== "object") return { violations: [{ code: "no-baseline" }], unmeasured: [], ratios: [] };

  validateConfig(config);
  const violations = checkUpgrades(Array.isArray(config.upgrades) ? config.upgrades : [], pacing);
  const unmeasured = [];
  let ratios = [];

  if (config.rebirth) {
    const r = checkRebirth(config.rebirth, pacing);
    ratios = r.ratios;
    violations.push(...r.violations);
  } else unmeasured.push("rebirth");

  if (config.offline) violations.push(...checkOffline(config.offline, pacing));
  else unmeasured.push("offline");

  if (isFiniteNumber(config.peakBalance)) {
    if (config.peakBalance > pacing.precisionLimit) {
      violations.push({ code: "precision", peakBalance: config.peakBalance, limit: pacing.precisionLimit,
        why: "배정밀도는 2^53(약 9e15)까지만 정수가 정확하다. 넘으면 작은 수입이 반올림으로 사라진다" });
    }
  } else unmeasured.push("peakBalance");

  return { violations, unmeasured, ratios };
}

// 실행 진입점. stdin 으로 { genre, config } 를 받아 결과를 JSON 으로 낸다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    const input = readCliInput();
    const profile = loadProfile(input.genre);
    process.stdout.write(JSON.stringify(checkPacing({ profile, config: input.config })) + "\n");
  });
}
