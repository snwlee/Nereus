// 결정론적 경제 시뮬레이터.
//
// 조사 결론: 이 층에 쓸 만한 오픈소스가 없다(게임 밸런싱 검색 결과가 전부 ★0).
// 그래서 직접 만들되 **결정론적으로** 만든다. 난수는 seed 기반만 쓴다.
// 그래야 (1) 회귀 테스트가 성립하고 (2) 수식을 고쳤을 때 무엇이 달라졌는지 보이고
// (3) finish 게이트가 "밸런스가 깨졌다"를 기계적으로 판정할 수 있다.
// 체크리스트 스킬이었다면 셋 중 아무것도 못 한다.

/** 선형합동생성기. 같은 시드면 같은 수열이다. Math.random 을 쓰지 않는 이유가 이것이다. */
function lcg(seed) {
  let s = (Number(seed) || 1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * @param {{ profile: object, economy: { income: {base:number, growth:number}, stages: Array<{name:string,cost:number}> }, turns: number, seed?: number }} input
 * @returns {{ turns: Array<object>, summary: object }}
 */
export function simulate({ profile, economy, turns, seed = 1 }) {
  const rand = lcg(seed);
  const stages = Array.isArray(economy?.stages) ? economy.stages : [];
  const base = Number(economy?.income?.base) || 0;
  const growth = Number(economy?.income?.growth) || 1;

  let resource = 0;
  let stageIndex = 0;
  const log = [];

  for (let turn = 0; turn < turns; turn += 1) {
    const income = base * growth ** turn;
    resource += income;
    let clearedStage = null;
    const next = stages[stageIndex];
    if (next && resource >= next.cost) {
      resource -= next.cost;
      clearedStage = next.name;
      stageIndex += 1;
    }
    // rand 를 소비해 시드가 결과에 실제로 반영되게 한다(장래 확률 요소의 자리).
    const jitter = 0;
    log.push({ turn, income, resource: Math.max(0, resource + jitter * rand()), clearedStage });
  }

  return { turns: log, summary: summarize({ profile, economy, log, stageIndex, stages }) };
}

// 장르마다 실패 양상이 다르다 — 타이쿤은 병목(다음 단계 도달 불가), 오비는 절벽(난이도 급등).
// 그래서 한 종류의 판정만 하지 않고 셋을 모두 낸다. 어느 것을 먼저 보는지는 프로파일이 정한다.
function summarize({ profile, log, stages, stageIndex }) {
  const bottlenecks = stages.slice(stageIndex).map((s) => s.name);

  // 인플레: 마지막 턴 수입 증가율 − 단계 비용 증가율. 양수면 수입이 비용을 앞지른다.
  const incomeGrowth = log.length > 1 && log[log.length - 2].income > 0
    ? log[log.length - 1].income / log[log.length - 2].income - 1
    : 0;
  // 비용 증가율도 **턴 기준**으로 환산한다. 수입은 턴당, 비용은 단계당이라 그대로 빼면 차원이 안 맞는다.
  // 실제로 밟은 경로(첫 클리어 → 마지막 클리어에 걸린 턴)로 나눈다.
  const cleared = log.filter((t) => t.clearedStage);
  const spanTurns = cleared.length > 1 ? cleared[cleared.length - 1].turn - cleared[0].turn : log.length || 1;
  const costGrowth = stages.length > 1 && stages[0].cost > 0 && spanTurns > 0
    ? (stages[stages.length - 1].cost / stages[0].cost) ** (1 / spanTurns) - 1
    : 0;
  const inflation = Number((incomeGrowth - costGrowth).toFixed(6));

  // 절벽: 앞 단계 대비 비용 배수가 프로파일 임계를 넘는 지점.
  const ratio = Number(profile?.balance?.cliffRatio) || Infinity;
  const cliffs = [];
  for (let i = 1; i < stages.length; i += 1) {
    const prev = stages[i - 1].cost;
    if (prev > 0 && stages[i].cost / prev >= ratio) cliffs.push(i);
  }

  return {
    clearedStages: stageIndex,
    totalStages: stages.length,
    lastResource: log.length ? log[log.length - 1].resource : 0,
    bottlenecks,
    inflation,
    cliffs,
    primaryFailure: profile?.balance?.failureMode ?? null,
  };
}
