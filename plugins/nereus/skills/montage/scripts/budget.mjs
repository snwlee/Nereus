#!/usr/bin/env node
// 유료 생성 예산 CLI. 잔액·가격은 공급자 사이트에서 읽는다(Aside 브라우저, 로그인 세션 사용). 실패하면 사람에게 묻는다.
//   budget.mjs init --limit <USD>        예산을 정하고 시작 잔액을 읽는다
//   budget.mjs balance [--set <USD>]     사이트 잔액을 읽는다(자동). 실패 시 종료코드 3 → 사용자에게 물어 --set
//   budget.mjs plan --usd <USD> --note   배치 전 비용 계획을 기록한다
//   budget.mjs prices                    사이트 가격표(정가)를 모델별로 보인다
//   budget.mjs status                    사용액(잔액 차이)·남은 예산
// 저장: <cwd>/.nereus/budget.json — 판정은 hooks/scripts/lib/budget.mjs, 차단은 pre-tool-guard 가 한다.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { parseBalance, parsePrices, spentUsd } from "../../../hooks/scripts/lib/budget.mjs";

// 공급자 페이지. 지금은 Higgsfield 만. 다른 공급자는 여기 한 줄을 더한다.
const PROVIDER_PAGES = Object.freeze({
  higgsfield: { billing: "https://open.higgsfield.ai/billing", pricing: "https://open.higgsfield.ai/pricing", pages: 3 },
});

const arg = (argv, k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };

function snapshotCode(url, pages = 1) {
  return `const bt = await openTab(${JSON.stringify(url)}); await sleep(3500); let bOut = (await snapshot(page)).tree;` +
    (pages > 1 ? ` for (let bp = 2; bp <= ${pages}; bp++) { try { await page.getByRole('button', { name: 'Page ' + bp }).click(); await sleep(1500); bOut += '\\n' + (await snapshot(page)).tree; } catch (e) { break; } }` : "") +
    ` console.log(page.url()); console.log(bOut); await closeTab(bt);`;
}

/** 기본 Aside 러너. 브라우저에 로그인돼 있어야 청구 페이지가 읽힌다. */
const asideSnapshot = (url, pages) => new Promise((resolve, reject) =>
  execFile("aside", ["repl", snapshotCode(url, pages)], { timeout: 150_000, maxBuffer: 8 << 20 }, (err, stdout) => (err ? reject(err) : resolve(stdout))));

const fileStore = (cwd) => {
  const f = path.join(cwd, ".nereus", "budget.json");
  return {
    read: () => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } },
    write: (j) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n"); },
  };
};

const MANUAL = "자동으로 사이트 잔액을 읽지 못했습니다. 사용자에게 공급자 대시보드의 현재 잔액을 물어 `budget.mjs balance --set <USD>` 로 기록하세요. (자동으로 하려면 사용자가 Aside 브라우저에서 한 번 로그인하면 됩니다.)";

async function readBalance(deps, provider) {
  try { return parseBalance(await deps.aside(PROVIDER_PAGES[provider].billing, 1)); } catch { return null; }
}

export async function runBudget(argv, deps = {}) {
  const store = deps.store ?? fileStore(deps.cwd ?? process.cwd());
  const now = deps.now ?? Date.now;
  const aside = deps.aside ?? asideSnapshot;
  const d = { ...deps, aside };
  const provider = arg(argv, "--provider") ?? "higgsfield";
  const at = () => new Date(now()).toISOString();
  const cmd = argv[0];

  if (cmd === "init") {
    const limit = Number(arg(argv, "--limit"));
    if (!(limit > 0)) return { code: 1, text: "--limit <USD> 가 필요합니다" };
    const set = arg(argv, "--balance");
    const usd = set !== undefined ? Number(set) : await readBalance(d, provider);
    const b = { provider, limitUsd: limit, startBalance: usd ?? null, readings: usd == null ? [] : [{ usd, at: at(), source: set !== undefined ? "manual" : "auto" }], plan: null };
    store.write(b);
    return usd == null ? { code: 3, text: `예산 $${limit} 를 정했지만 시작 잔액이 없습니다. ${MANUAL.replace("balance --set", "init --limit " + limit + " --balance")}` } : { code: 0, text: `예산 $${limit}, 시작 잔액 $${usd}` };
  }
  const b = store.read();
  if (cmd === "prices") {
    const p = PROVIDER_PAGES[provider];
    let text; try { text = await aside(p.pricing, p.pages); } catch (e) { return { code: 3, text: `가격표를 읽지 못했습니다: ${e.message}. ${p.pricing} 에서 직접 확인하세요.` }; }
    const rows = Object.entries(parsePrices(text));
    if (!rows.length) return { code: 3, text: `가격표를 해석하지 못했습니다. ${p.pricing} 에서 직접 확인하세요.` };
    return { code: 0, text: rows.map(([m, v]) => `${m}\t$${v.usd}/${v.unit}`).join("\n") + `\n(정가 기준 · ${at()} · ${p.pricing})` };
  }
  if (!b) return { code: 1, text: "예산 파일이 없습니다. 먼저 `budget.mjs init --limit <USD>`" };
  if (cmd === "balance") {
    const set = arg(argv, "--set");
    const usd = set !== undefined ? Number(set) : await readBalance(d, b.provider ?? provider);
    if (usd == null || Number.isNaN(usd)) return { code: 3, text: MANUAL };
    const next = { ...b, startBalance: b.startBalance ?? usd, readings: [...(b.readings ?? []), { usd, at: at(), source: set !== undefined ? "manual" : "auto" }] };
    store.write(next);
    return { code: 0, text: `잔액 $${usd} · 사용 $${spentUsd(next).toFixed(2)} / 예산 $${b.limitUsd}` };
  }
  if (cmd === "plan") {
    const usd = Number(arg(argv, "--usd"));
    if (!(usd >= 0)) return { code: 1, text: "--usd <USD> 가 필요합니다" };
    store.write({ ...b, plan: { usd, at: at(), note: arg(argv, "--note") ?? "" } });
    return { code: 0, text: `계획 $${usd} 기록` };
  }
  if (cmd === "status") {
    const spent = spentUsd(b); const last = (b.readings ?? []).at(-1);
    return { code: 0, text: `예산 $${b.limitUsd} · 사용 $${spent.toFixed(2)} · 남음 $${(b.limitUsd - spent).toFixed(2)} · 최근 잔액 ${last ? `$${last.usd} (${last.source}, ${last.at})` : "없음"}${b.plan ? ` · 계획 $${b.plan.usd} ${b.plan.note}` : ""}` };
  }
  return { code: 1, text: "사용법: budget.mjs init|balance|plan|prices|status" };
}

if (process.argv[1] && /budget\.mjs$/.test(process.argv[1]) && /skills[\\/]montage/.test(process.argv[1])) {
  runBudget(process.argv.slice(2)).then((r) => { process.stdout.write(r.text + "\n"); process.exit(r.code); });
}
