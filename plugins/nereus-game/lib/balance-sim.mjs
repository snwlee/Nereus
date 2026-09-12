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

function summarize({ log, stages, stageIndex }) {
  return { clearedStages: stageIndex, lastResource: log.length ? log[log.length - 1].resource : 0, totalStages: stages.length };
}
