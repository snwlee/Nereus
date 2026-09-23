// 유료 생성 예산 판정. 순수 함수. 사용액은 추정이 아니라 **공급자 사이트의 잔액 차이**로 잰다.
// budget.json (프로젝트 .nereus/): { limitUsd, startBalance, readings:[{usd,at,source}], plan:{usd,at,note}|null }
// 읽기·쓰기와 사이트 조회는 skills/montage/scripts/budget.mjs 가 한다.

export const BUDGET_DEFAULTS = Object.freeze({ freshMinutes: 20 });

const latest = (budget) => (budget?.readings ?? []).at(-1) ?? null;

export function spentUsd(budget) {
  const last = latest(budget);
  if (!last || typeof budget?.startBalance !== "number") return 0;
  return Math.max(0, budget.startBalance - last.usd);
}

const CLI = "node \"${NEREUS}/skills/montage/scripts/budget.mjs\"";

export function budgetVerdict({ budget, now = Date.now(), batch = false, freshMinutes = BUDGET_DEFAULTS.freshMinutes }) {
  if (!budget || typeof budget.limitUsd !== "number") return { allow: false, reason: `[nereus:budget] 이 프로젝트에 유료 생성 예산이 없습니다. 사용자에게 예산(USD)을 묻고 \`${CLI} init --limit <USD>\` 로 정하세요.` };
  const last = latest(budget);
  const age = last ? (now - Date.parse(last.at)) / 60_000 : Infinity;
  if (!(age <= freshMinutes)) return { allow: false, reason: `[nereus:budget] 공급자 잔액을 ${freshMinutes}분 안에 확인하지 않았습니다. \`${CLI} balance\` 로 사이트 잔액을 읽으세요(자동 실패 시 사용자에게 대시보드 잔액을 물어 \`balance --set <USD>\`).` };
  const spent = spentUsd(budget);
  const remaining = budget.limitUsd - spent;
  if (remaining <= 0) return { allow: false, reason: `[nereus:budget] 예산 $${budget.limitUsd} 를 다 썼습니다(사이트 잔액 기준 사용 $${spent.toFixed(2)}). 더 쓰려면 사용자가 예산을 올려야 합니다.` };
  if (batch) {
    const plan = budget.plan;
    const planAge = plan ? (now - Date.parse(plan.at)) / 60_000 : Infinity;
    if (!plan || !(planAge <= 24 * 60)) return { allow: false, reason: `[nereus:budget] 배치 생성 전에 비용 계획이 필요합니다. \`${CLI} prices\` 로 사이트 단가를 읽고 합계를 사용자에게 보인 뒤 \`${CLI} plan --usd <합계> --note "<무엇>"\` 로 기록하세요.` };
    if (plan.usd > remaining) return { allow: false, reason: `[nereus:budget] 계획 $${plan.usd} 가 남은 예산 $${remaining.toFixed(2)} 을 넘습니다. 컷을 줄이거나 사용자에게 예산 증액을 요청하세요.` };
  }
  return { allow: true, remainingUsd: remaining };
}

/** 청구 페이지 스냅샷 텍스트에서 잔액. 못 찾으면 null(로그인 화면 등). */
export function parseBalance(text) {
  const t = String(text ?? "");
  if (/sign-in|Log in\b|Welcome to/i.test(t) && !/balance/i.test(t)) return null;
  const near = /balance[^$]{0,80}\$\s?([\d,]+(?:\.\d+)?)/i.exec(t) ?? /\$\s?([\d,]+(?:\.\d+)?)\s*(?:USD)?[^$]{0,40}balance/i.exec(t);
  return near ? Number(near[1].replace(/,/g, "")) : null;
}

/** 가격 페이지 스냅샷에서 { "모델": {usd, unit} } — 할인 전 정가("from $X/unit" 첫 값)를 쓴다. */
export function parsePrices(text) {
  const out = {};
  const re = /link "([^",]+?)(?:,\s*\d+\s*modes)?"(?:(?!link ")[\s\S]){0,400}?from \$([\d.]+)\/(s|image|video|second)/g;
  let m;
  while ((m = re.exec(String(text ?? "")))) out[m[1].trim()] = { usd: Number(m[2]), unit: m[3] === "second" ? "s" : m[3] };
  return out;
}
