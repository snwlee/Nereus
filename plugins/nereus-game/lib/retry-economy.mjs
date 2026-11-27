// 캐주얼 퍼즐(이동 수 제한 레벨)의 재시도 경제 측정과 판정.
//
// balance-sim 의 세 축(병목·절벽·지배 전략)은 "목숨 고갈로 세션이 끊긴다"를 재지 못했다.
// 여기서 레벨마다 판을 시드 고정으로 돌려 첫 시도 클리어율·누적 클리어율·목숨 지표·이어하기 지표를 내고,
// 프로파일 `retry` 기준으로 절벽(retry-cliff)·인플레(retry-too-easy)·목숨 벽·약한 이어하기를 판정한다.
//
// 판 모델은 "수마다 진척을 [min,max] 균등분포로 뽑아 더한다"는 운 모델이다. 무작위 리필 매치-3 류에 맞고,
// 같은 판을 다시 하는 고정 판 퍼즐에는 맞지 않는다. 정확 계산 대신 표본을 쓰는 이유는 판 모델을
// 보드 규칙·봇으로 바꿔도 같은 인터페이스와 지표 정의로 남게 하려는 것이다(스펙 balanceSim.retry).
import { lcg, mixSeed } from "./seeded-random.mjs";
import { loadProfile } from "./profiles.mjs";
import { readCliInput, runCli } from "./cli-input.mjs";

const TIERS = ["early", "mid", "hard"];
const NO_BASELINE_RETRY = { trials: 2000, attempts: 5, earlyLevels: 10, minContinueFailures: 50 };
const MAX_MOVES = 1000;
const MAX_TRIALS = 100000;
const MAX_DRAWS = 2e8;
// 소수 진척(0.3 × 10)의 부동소수 누적이 목표를 아주 조금 밑도는 것을 클리어로 본다.
const GOAL_EPSILON = 1e-9;
const BORDERLINE_SIGMAS = 2;
const DIGITS = 4;

const isPositiveInt = (v) => Number.isInteger(v) && v > 0;
const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);
const inUnit = (v) => isFiniteNumber(v) && v >= 0 && v <= 1;
const round = (v) => (v === null ? null : Number(v.toFixed(DIGITS)));

function fail(message) {
  throw new Error(`retry-economy: ${message}`);
}

function validateTiers(tiers) {
  if (!tiers || typeof tiers !== "object") fail("profile.retry.tiers 가 없다");
  for (const name of TIERS) {
    const t = tiers[name];
    if (!t) fail(`profile.retry.tiers 에 ${name} 이 없다`);
    const [lo, hi] = Array.isArray(t.firstTry) ? t.firstTry : [];
    if (!(inUnit(lo) && inUnit(hi) && lo <= hi)) fail(`tiers.${name}.firstTry 는 0 ≤ lo ≤ hi ≤ 1 이어야 한다`);
    if (!inUnit(t.maxLivesOut)) fail(`tiers.${name}.maxLivesOut 은 0~1 이어야 한다`);
  }
}

/** 프로파일 `retry` 를 검증한다. 키는 모두 필수 — 빠진 기준을 기본값으로 메우면 그럴듯한 초록이 된다. */
function validateRetry(retry) {
  if (!(isPositiveInt(retry.trials) && retry.trials <= MAX_TRIALS)) fail(`profile.retry.trials 는 1~${MAX_TRIALS} 정수여야 한다`);
  for (const key of ["attempts", "minContinueFailures"]) {
    if (!isPositiveInt(retry[key])) fail(`profile.retry.${key} 는 양의 정수여야 한다`);
  }
  // 0 은 "위치로 정하는 초반 레벨이 없다"는 뜻이다.
  if (!(Number.isInteger(retry.earlyLevels) && retry.earlyLevels >= 0)) fail("profile.retry.earlyLevels 는 0 이상 정수여야 한다");
  if (!inUnit(retry.minContinueSave)) fail("profile.retry.minContinueSave 는 0~1 이어야 한다");
  validateTiers(retry.tiers);
}

function validateLevel(level, index) {
  const key = level?.id ?? level?.name;
  const at = `levels[${index}](${key ?? "?"})`;
  if (typeof key !== "string" || key === "") fail(`${at}: id 또는 name 이 비지 않은 문자열이어야 한다`);
  if (!(isPositiveInt(level.moves) && level.moves <= MAX_MOVES)) fail(`${at}: moves 는 1~${MAX_MOVES} 정수여야 한다`);
  if (!(isFiniteNumber(level.goal) && level.goal > 0)) fail(`${at}: goal 은 유한한 양수여야 한다`);
  const [min, max] = Array.isArray(level.progress) ? level.progress : [];
  if (!(isFiniteNumber(min) && isFiniteNumber(max) && min >= 0 && min <= max)) fail(`${at}: progress 는 0 ≤ min ≤ max 여야 한다`);
  if (level.tier !== undefined && !TIERS.includes(level.tier)) fail(`${at}: tier 는 ${TIERS.join("·")} 중 하나여야 한다`);
  return key;
}

function validateLevels(levels) {
  if (!Array.isArray(levels)) fail("levels 는 배열이어야 한다");
  const seen = new Set();
  levels.forEach((level, i) => {
    const key = validateLevel(level, i);
    if (seen.has(key)) fail(`levels: 키 ${key} 가 겹친다`);
    seen.add(key);
  });
}

/** simulate() 와 같은 해석: cap 이 유한한 양수면 목숨 있음, 아니면 없음. */
function readLives(lives) {
  if (lives === undefined || lives === null) return null;
  if (typeof lives !== "object") fail("lives 는 객체여야 한다");
  const cap = Number(lives.cap);
  if (!(Number.isFinite(cap) && cap > 0)) return null;
  if (!Number.isInteger(cap)) fail("lives.cap 은 정수여야 한다");
  return cap;
}

function readContinue(offer) {
  if (offer === undefined || offer === null) return null;
  if (typeof offer !== "object") fail("continueOffer 는 객체여야 한다");
  if (!(isPositiveInt(offer.moves) && offer.moves <= MAX_MOVES)) fail(`continueOffer.moves 는 1~${MAX_MOVES} 정수여야 한다`);
  if (!(isFiniteNumber(offer.price) && offer.price >= 0)) fail("continueOffer.price 는 유한한 0 이상이어야 한다");
  return offer;
}

function checkBudget(levels, trials, offer) {
  const extra = offer ? offer.moves : 0;
  const draws = levels.reduce((sum, l) => sum + trials * (l.moves + extra), 0);
  if (draws > MAX_DRAWS) fail(`총 추출 수 ${draws} 가 상한 ${MAX_DRAWS}(2e8)를 넘는다`);
}

/**
 * 레벨 하나를 trials 판 돌린다. 기본 판은 항상 정확히 moves 개를 뽑아 판끼리 난수 소비가 같고,
 * 이어하기는 별도 난수열을 써서 continueOffer 유무가 기본 판 결과를 바꾸지 않는다.
 */
function playLevel(level, seed, trials, offer) {
  const levelSeed = mixSeed(seed, level.id ?? level.name);
  const base = lcg(levelSeed);
  const extra = lcg(mixSeed(levelSeed, "continue"));
  const [min, max] = level.progress;
  const draw = (rand) => min + (max - min) * rand();
  const target = level.goal - GOAL_EPSILON;
  let wins = 0;
  let saves = 0;
  for (let t = 0; t < trials; t += 1) {
    let sum = 0;
    for (let m = 0; m < level.moves; m += 1) sum += draw(base);
    if (sum >= target) { wins += 1; continue; }
    if (!offer) continue;
    for (let m = 0; m < offer.moves; m += 1) sum += draw(extra);
    if (sum >= target) saves += 1;
  }
  return { wins, fails: trials - wins, saves };
}

function borderline(p, range, trials) {
  if (!range) return false;
  const sigma = Math.sqrt((p * (1 - p)) / trials);
  const [lo, hi] = range;
  const near = (bound) => Math.abs(p - bound) <= BORDERLINE_SIGMAS * sigma;
  return (lo > 0 && near(lo)) || (hi < 1 && near(hi));
}

function metricsFor({ wins, fails, saves }, ctx) {
  const { retry, cap, offer, range } = ctx;
  const p = wins / retry.trials;
  const q = offer && fails >= retry.minContinueFailures ? saves / fails : null;
  const denom = q === null ? 0 : p + (1 - p) * q;
  const cumulative = Array.from({ length: retry.attempts }, (_, i) => 1 - (1 - p) ** (i + 1));
  return {
    p,
    q,
    livesOut: cap === null ? null : (1 - p) ** cap,
    public: {
      firstTryWinRate: round(p),
      cumulativeWinRate: cumulative.map(round),
      expectedLivesPerClear: p === 0 ? null : round((1 - p) / p),
      livesOutRate: cap === null ? null : round((1 - p) ** cap),
      continueSaveRate: round(q),
      continueCostPerClear: denom > 0 ? round((offer.price * (1 - p)) / denom) : null,
      borderline: borderline(p, range, retry.trials),
    },
  };
}

function judgeLevel(name, tierRule, m, minContinueSave) {
  const [lo, hi] = tierRule.firstTry;
  const out = [];
  const add = (code, value, bound, why) => out.push({ code, level: name, value: round(value), ...bound, why });
  if (m.p < lo) add("retry-cliff", m.p, { range: [lo, hi] }, "첫 시도 클리어율이 티어 범위보다 낮다 — 난이도 절벽");
  if (m.p > hi) add("retry-too-easy", m.p, { range: [lo, hi] }, "첫 시도 클리어율이 티어 범위보다 높다 — 재시도가 일어나지 않는다");
  if (m.livesOut !== null && m.livesOut > tierRule.maxLivesOut) {
    add("lives-wall", m.livesOut, { limit: tierRule.maxLivesOut }, "목숨 한 줄을 다 쓰고도 못 깰 확률이 상한을 넘는다 — 세션이 끊긴다");
  }
  if (m.q !== null && m.q < minContinueSave) {
    add("continue-weak", m.q, { limit: minContinueSave }, "이어하기를 사도 구해지는 판이 적다");
  }
  return out;
}

function tierOf(level, index, earlyLevels) {
  return level.tier ?? (index < earlyLevels ? "early" : "mid");
}

function unmeasuredAxes(levels, cap, offer) {
  return [
    ...(levels.length === 0 ? ["levels"] : []),
    ...(cap === null ? ["lives"] : []),
    ...(offer === null ? ["continue"] : []),
  ];
}

/**
 * @param {{ profile: object, levels: Array<object>, lives?: object, continueOffer?: object, seed?: number }} input
 * @returns {{ levels: Array<object>, violations: Array<object>, unmeasured: string[] }}
 */
export function measureRetry({ profile, levels, lives, continueOffer, seed = 1 }) {
  const hasBaseline = Boolean(profile?.retry);
  if (hasBaseline) validateRetry(profile.retry);
  const retry = hasBaseline ? profile.retry : NO_BASELINE_RETRY;
  validateLevels(levels);
  const cap = readLives(lives);
  const offer = readContinue(continueOffer);
  checkBudget(levels, retry.trials, offer);
  const baseSeed = (Number(seed) || 1) >>> 0;

  const violations = hasBaseline ? [] : [{ code: "no-baseline", why: "프로파일에 retry 기준이 없다 — 지표는 냈지만 판정하지 않았다" }];
  const measured = levels.map((level, i) => {
    const tier = tierOf(level, i, retry.earlyLevels);
    const tierRule = hasBaseline ? retry.tiers[tier] : null;
    const m = metricsFor(playLevel(level, baseSeed, retry.trials, offer), { retry, cap, offer, range: tierRule?.firstTry });
    if (tierRule) violations.push(...judgeLevel(level.name, tierRule, m, retry.minContinueSave));
    return { name: level.name, tier, ...m.public };
  });
  return { levels: measured, violations, unmeasured: unmeasuredAxes(levels, cap, offer) };
}

// 실행 진입점. stdin 으로 { genre, retry?, levels, lives?, continueOffer?, seed? } 를 받아 결과를 JSON 으로 낸다.
// retry 를 주면 장르 프로파일의 retry 를 통째로 대신한다(게임별 기준 덮어쓰기). 위반이 있어도 종료 코드는 0 이다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    const input = readCliInput();
    const base = loadProfile(input.genre);
    const profile = input.retry === undefined ? base : { ...base, retry: input.retry };
    const result = measureRetry({ profile, levels: input.levels, lives: input.lives, continueOffer: input.continueOffer, seed: input.seed });
    process.stdout.write(JSON.stringify(result) + "\n");
  });
}
