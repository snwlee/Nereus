// 조사에서 WebFetch 가 403·캡차·Cloudflare 로 막혔을 때만 쓰는 차단 우회 경로 (Scrapling, BSD-3).
// 사용: node scrape.mjs <url> [--out <디렉터리>]   → 표준 출력 JSON, 종료 코드 0 = 본문 확보, 1 = 실패
//
// 가벼운 것부터 올린다:
//   1) get   — 브라우저 없이 크롬 TLS 지문 흉내(curl_cffi). 1~2초.
//   2) fetch — 스텔스 브라우저(patchright) + Cloudflare 풀이. 10~70초.
// 2026-11-12 스파이크(차단 6곳): fetch 4/6(재실행 동일), get 1/6, 이전 경로 CloakBrowser 2~3/6.
// DataDome(g2)·Akamai(coupang) 는 둘 다 못 뚫었다 — 그런 곳은 실패로 보고하고 다른 1차 자료를 찾는다.
//
// **종료 코드를 믿지 않는다.** scrapling 은 차단 화면을 받아도 0 으로 끝난다(g2 → "Please enable JS ...").
// 그래서 받은 내용을 blockedReason 으로 판정하고, 차단 화면을 자료로 넘기지 않는다.
import fs from "node:fs";
import path from "node:path";
import { which, run as execRun } from "../../../hooks/scripts/lib/exec.mjs";

export const INSTALL = 'uv tool install "scrapling[fetchers,ai]"';
const MIN_CHARS = 800;
const HEAD = 3000; // 차단 문구는 화면 앞쪽에 있다. 본문 뒤쪽의 "blocked" 같은 낱말로 막지 않는다.
const BLOCK = new RegExp([
  "Just a moment", "Attention Required", "Access Denied", "verify you are human", "Verifying you are human",
  "Pardon Our Interruption", "Request unsuccessful", "px-captcha", "unusual traffic", "Checking your browser",
  "Incapsula incident", "Please enable JS", "Enable JavaScript and cookies to continue",
  "보안 확인 수행 중", "사용자가 봇이 아님을 확인",
].join("|"), "i");

/** 받은 내용이 본문이 아니면 이유를, 본문이면 null. */
export function blockedReason(text) {
  const body = String(text ?? "").replace(/\s+/g, " ").trim();
  const hit = BLOCK.exec(body.slice(0, HEAD));
  if (hit) return `차단 화면("${hit[0]}")`;
  if (body.length < MIN_CHARS) return `본문이 너무 짧다(${body.length}자)`;
  return null;
}

/** 시도 순서. 순수 함수 — 실행하지 않는다. */
export function planSteps(url, outDir) {
  const slug = String(url).replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_").slice(0, 80);
  const out = (m) => path.join(outDir, `${slug}.${m}.md`);
  return [
    { method: "get", out: out("get"), timeoutMs: 60000,
      args: ["extract", "get", url, out("get"), "--impersonate", "chrome", "--ai-targeted", "--timeout", "45"] },
    { method: "fetch", out: out("fetch"), timeoutMs: 180000,
      args: ["extract", "fetch", url, out("fetch"), "--solve-cloudflare", "--network-idle", "--ai-targeted", "--timeout", "90000"] },
  ];
}

const DEFAULT_DEPS = {
  available: () => !!which("scrapling"),
  // 한글 Windows(cp949) 콘솔에서 rich 출력이 UnicodeEncodeError 로 죽지 않게 UTF-8 을 강제한다.
  run: (bin, args, timeoutMs) => execRun(bin, args, { timeoutMs, env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" } }),
  read: (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } },
};

/** get → fetch 로 올리며 본문을 얻는다. 둘 다 막히면 ok:false 와 단계별 이유를 낸다. */
export function scrapeEscalate(url, outDir, deps = DEFAULT_DEPS) {
  const tried = [];
  if (!deps.available()) {
    return { ok: false, url, method: null, file: null, chars: 0, tried, reason: "scrapling 미설치", fix: `${INSTALL} 후 nereus:setup 의 scrapling 안내` };
  }
  for (const step of planSteps(url, outDir)) {
    const started = Date.now();
    const r = deps.run("scrapling", step.args, step.timeoutMs);
    const sec = Math.round((Date.now() - started) / 100) / 10;
    if (!r?.ok) {
      const why = String(r?.stderr ?? "").trim().split(/\r?\n/).pop() || `종료 코드 ${r?.status}`;
      tried.push({ method: step.method, ok: false, sec, reason: `실행 실패: ${why.slice(0, 200)}` });
      continue;
    }
    const text = deps.read(step.out);
    const reason = blockedReason(text);
    if (reason) { tried.push({ method: step.method, ok: false, sec, reason }); continue; }
    tried.push({ method: step.method, ok: true, sec });
    return { ok: true, url, method: step.method, file: step.out, chars: String(text).length, tried };
  }
  return { ok: false, url, method: null, file: null, chars: 0, tried, reason: "두 단계 모두 막힘 — 다른 1차 자료를 찾는다" };
}

if (process.argv[1] && /scrape\.mjs$/.test(process.argv[1])) {
  const [url, ...rest] = process.argv.slice(2);
  const i = rest.indexOf("--out");
  const outDir = i >= 0 && rest[i + 1] ? rest[i + 1] : path.join(process.cwd(), ".nereus", "research", "scraped");
  if (!/^https?:\/\//.test(url ?? "")) {
    process.stderr.write("사용: node scrape.mjs <http(s) URL> [--out <디렉터리>]\n");
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const r = scrapeEscalate(url, outDir);
  process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  process.exitCode = r.ok ? 0 : 1;
}
