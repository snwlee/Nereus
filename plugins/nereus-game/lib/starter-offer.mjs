// 1회 한정 첫 구매 상품(스타터) 판정.
//
// 채택한 설계 규칙: 첫 결제 문턱을 낮추는 상품은 하나·한 번이고, 가장 싸며, 산 뒤 그 자리를 더 비싼 상품으로
// 교체하지 않는다. 상품 목록의 가격·가치만 보는 정적 검사라 데이터에 적히지 않은 런타임 교체는 잡지 못한다 —
// 사용자 상태로 가격을 바꾸는지는 compliance 몫이다. 턴·자원과 무관해 balance-sim 에 배선하지 않는다.
import { readCliInput, runCli } from "./cli-input.mjs";

const REAL = "real";

function fail(message) {
  throw new Error(`starter-offer: ${message}`);
}

const currencyOf = (p) => p.currency ?? REAL;
const isPaid = (p) => p.price > 0;
const hasValue = (p) => typeof p.value === "number" && Number.isFinite(p.value);

function validateProducts(products) {
  if (!Array.isArray(products)) fail("shop.products 는 배열이어야 한다");
  const bySku = new Map();
  for (const p of products) {
    if (typeof p?.sku !== "string" || p.sku === "") fail("상품마다 비지 않은 sku 가 있어야 한다");
    if (bySku.has(p.sku)) fail(`sku ${p.sku} 가 겹친다`);
    if (!(typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0)) fail(`${p.sku}: price 는 유한한 0 이상이어야 한다`);
    bySku.set(p.sku, p);
  }
  for (const p of products) {
    if (p.replacedBy !== undefined && !bySku.has(p.replacedBy)) fail(`${p.sku}: replacedBy ${p.replacedBy} 가 목록에 없다`);
  }
  return bySku;
}

/** sku 에서 replacedBy 를 따라간 교체 사슬(자신 제외). 순환이면 던진다. */
function replacementChain(start, bySku) {
  const chain = [];
  const seen = new Set([start.sku]);
  let next = start.replacedBy;
  while (next !== undefined) {
    if (seen.has(next)) fail(`${start.sku}: 교체 사슬이 순환한다(${[...seen, next].join(" → ")})`);
    seen.add(next);
    const p = bySku.get(next);
    chain.push(p);
    next = p.replacedBy;
  }
  return chain;
}

function judgeStarter(s, products, bySku) {
  const out = [];
  const sameCurrency = (p) => currencyOf(p) === currencyOf(s);
  if (s.oneTime !== true) out.push({ code: "starter-not-one-time", sku: s.sku, why: "스타터는 한 번만 살 수 있어야 한다" });
  const cheaper = products.filter((p) => p !== s && isPaid(p) && sameCurrency(p) && p.price < s.price);
  if (isPaid(s) && cheaper.length) {
    out.push({ code: "starter-not-cheapest", sku: s.sku, cheaper: cheaper.map((p) => p.sku), why: "첫 결제 문턱을 낮추려면 스타터가 가장 싸야 한다" });
  }
  const pricier = replacementChain(s, bySku).filter((p) => sameCurrency(p) && p.price > s.price);
  if (pricier.length) {
    out.push({ code: "starter-replaced-pricier", sku: s.sku, replacedBy: pricier.map((p) => p.sku), why: "산 뒤 그 자리를 더 비싼 상품으로 교체하면 첫 구매 문턱이 올라간다" });
  }
  return out;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // 짝수 개면 가운데 둘의 평균 — 상품 수가 적어 위쪽 값 하나로 치우치지 않게 한다.
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function valueRatio(starters, products) {
  if (starters.length !== 1) return null;
  const [s] = starters;
  if (!isPaid(s) || !hasValue(s)) return null;
  const others = products
    .filter((p) => p !== s && isPaid(p) && hasValue(p) && currencyOf(p) === currencyOf(s))
    .map((p) => p.value / p.price);
  if (!others.length) return null;
  const base = median(others);
  return base > 0 ? Number(((s.value / s.price) / base).toFixed(4)) : null;
}

/**
 * @param {{ shop: { products: Array<{ sku: string, price: number, currency?: string, value?: number, oneTime?: boolean, starter?: boolean, replacedBy?: string }> } }} input
 * @returns {{ violations: Array<object>, metrics: { starterSku: string|null, valueRatio: number|null } }}
 */
export function checkStarterOffer({ shop } = {}) {
  const products = shop?.products;
  const bySku = validateProducts(products);
  // 순환은 스타터가 아닌 상품의 사슬에서도 데이터 오류다.
  for (const p of products) replacementChain(p, bySku);

  const starters = products.filter((p) => p.starter === true);
  const violations = [];
  if (!starters.length && products.some((p) => isPaid(p) && currencyOf(p) === REAL)) {
    violations.push({ code: "starter-missing", why: "현금 유료 상품이 있는데 1회 한정 첫 구매 상품이 없다" });
  }
  if (starters.length > 1) {
    violations.push({ code: "starter-duplicate", skus: starters.map((s) => s.sku), why: "첫 구매 상품은 하나여야 한다" });
  }
  for (const s of starters) violations.push(...judgeStarter(s, products, bySku));
  return {
    violations,
    metrics: { starterSku: starters.length === 1 ? starters[0].sku : null, valueRatio: valueRatio(starters, products) },
  };
}

// 실행 진입점. stdin 으로 { shop } 을 받아 결과를 JSON 으로 낸다. 위반이 있어도 종료 코드는 0 이다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(checkStarterOffer(readCliInput())) + "\n");
  });
}
