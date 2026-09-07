// MCP 상주 비용 진단. 세션마다 MCP 서버가 뜨는데 그 비용이 아무 데도 안 보여서, 디스크·메모리
// 압박으로 뒤늦게 발견하게 된다. 이 스크립트가 지금 떠 있는 프로세스를 계열별로 합산해 보여준다.
//
// 사용: node mcp-doctor.mjs [--min-age 3600]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run } from "../../../hooks/scripts/lib/exec.mjs";

const FAMILIES = [
  // 순서가 중요하다. watchdog·Chrome 은 커맨드라인에 chrome-devtools-mcp 를 포함하므로 먼저 걸러야 한다.
  { family: "browser 텔레메트리", re: /chrome-devtools-mcp.*telemetry\/watchdog/ },
  { family: "Chrome", re: /(Google Chrome|Chrome for Testing|chromium).*(chrome-devtools-mcp|remote-debugging-port)|Chrome Helper/i },
  { family: "npx 래퍼", re: /npm-cli\.js\s+exec|\/npx\b/ },
  { family: "browser MCP", re: /chrome-devtools-mcp/ },
  { family: "context7 MCP", re: /context7-mcp/ },
  // nereus 소유가 아닌 사용자 전역 MCP. 비용의 전체 그림을 보여주되 소유를 구분해 표시한다 —
  // 여기 잡히는 것을 nereus 설정으로 끄려 해도 끌 수 없다.
  { family: "기타 MCP(사용자 설정)", re: /(codegraph[\w-]*(mcp|\/dist\/server)|credstore[.\w-]*mcp|[\w-]+-mcp\b|mcp[-_]server)/i },
];

export function classify(command) {
  const cmd = String(command ?? "");
  if (!cmd.trim()) return null;
  for (const f of FAMILIES) if (f.re.test(cmd)) return f.family;
  return null;
}

const toMb = (kb) => Math.round(kb / 1024);

export function summarize(rows) {
  const agg = new Map();
  for (const r of rows) {
    const family = classify(r.command);
    if (!family) continue;
    const cur = agg.get(family) ?? { family, kb: 0, count: 0 };
    agg.set(family, { family, kb: cur.kb + r.rss, count: cur.count + 1 });
  }
  const families = [...agg.values()].sort((a, b) => b.kb - a.kb).map(({ family, kb, count }) => ({ family, mb: toMb(kb), count }));
  return { families, totalMb: families.reduce((s, f) => s + f.mb, 0) };
}

/** ps 의 elapsed 표기(`MM:SS`, `HH:MM:SS`, `D-HH:MM:SS`)를 초로. */
export function elapsedSeconds(text) {
  const s = String(text ?? "").trim();
  const [days, clock] = s.includes("-") ? s.split("-") : ["0", s];
  const parts = clock.split(":").map(Number);
  while (parts.length < 3) parts.unshift(0);
  const [h, m, sec] = parts;
  return Number(days) * 86400 + h * 3600 + m * 60 + sec;
}

/** 부모가 죽어 init(1)에 재부모된 MCP 프로세스. 오래 떠 있으면 아무도 안 쓰는 유령이다. */
export function findStrays(rows, { minSeconds = 3600 } = {}) {
  return rows
    .filter((r) => r.ppid === 1 && classify(r.command))
    .map((r) => ({ pid: r.pid, family: classify(r.command), mb: toMb(r.rss), ageSeconds: elapsedSeconds(r.elapsed) }))
    .filter((r) => r.ageSeconds >= minSeconds);
}

export function checkMcpConfig(cfg) {
  const servers = cfg?.mcpServers;
  if (!servers || typeof servers !== "object") return [];
  const findings = [];
  for (const [server, spec] of Object.entries(servers)) {
    const args = Array.isArray(spec?.args) ? spec.args.join(" ") : "";
    // 패키지 스펙에 `@<숫자로 시작하는 버전>` 이 없으면 고정되지 않은 것이다(`@latest`, 버전 생략 모두).
    const pinned = /@\d[\w.-]*(\s|$)/.test(args);
    if (args && !pinned) {
      findings.push({ category: "unpinned", server, message: "버전이 고정돼 있지 않다 — 세션마다 npm 레지스트리를 조회하고 ~/.npm/_npx 에 사본이 쌓인다" });
    }
    if (/chrome-devtools-mcp/.test(args) && !spec?.env?.CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS) {
      findings.push({ category: "telemetry_on", server, message: "텔레메트리가 켜져 있다 — MCP 핸드셰이크마다 watchdog 자식 프로세스(실측 51MB)가 함께 뜬다" });
    }
  }
  return findings;
}

const hours = (s) => (s >= 86400 ? `${Math.floor(s / 86400)}일 ${Math.floor((s % 86400) / 3600)}시간` : `${Math.floor(s / 3600)}시간`);

export function report({ summary, strays = [], npxCacheMb = 0, findings = [] }) {
  const lines = ["## MCP 상주 비용", ""];
  if (!summary.families.length) {
    lines.push("- 떠 있는 MCP 프로세스 없음 — 정상", "", `- npx 캐시: ${npxCacheMb}MB`);
    return lines.join("\n");
  }
  for (const f of summary.families) lines.push(`- ${f.family}: **${f.mb}MB** (${f.count}개)`);
  lines.push(`- 합계: **${summary.totalMb}MB**`);
  lines.push("", `- npx 캐시(~/.npm/_npx): ${npxCacheMb}MB`);

  if (strays.length) {
    lines.push("", "### 유령 프로세스 (부모가 죽어 init 에 재부모됨)");
    for (const s of strays) lines.push(`- pid ${s.pid} — ${s.family}, ${s.mb}MB, ${hours(s.ageSeconds)} 경과 → \`kill ${s.pid}\``);
  }
  if (findings.length) {
    lines.push("", "### 설정 문제");
    for (const f of findings) lines.push(`- [${f.category}] ${f.server} — ${f.message}`);
  }
  lines.push(
    "",
    "### 줄이는 방법",
    "1. **안 쓰는 서버를 끈다** — 사용자 설정(`~/.claude/settings.json`)에 넣는다. 플러그인 업데이트에 덮이지 않는다.",
    '   ```json',
    '   { "deniedMcpServers": ["plugin:nereus:browser"] }',
    '   ```',
    "   `plugin:nereus:browser` 를 끄면 스크린샷·Lighthouse 가 사라진다 — nereus:design 의 렌더 라운드, qa, seo 가 함께 막힌다. `plugin:nereus:context7` 는 라이브러리 문서 조회만 잃는다.",
    "2. **세션 수를 줄인다** — 비용은 세션당 배수로 붙는다. 안 쓰는 Claude 세션을 닫는 것이 가장 큰 절감이다.",
    "3. **유령 프로세스를 정리한다** — 위 목록의 `kill`.",
  );
  return lines.join("\n");
}

export function psRows(runner = run) {
  const r = runner("ps", ["-Ao", "pid,ppid,rss,etime,command"]);
  const rows = [];
  for (const line of r.stdout.split("\n").slice(1)) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    if (m) rows.push({ pid: Number(m[1]), ppid: Number(m[2]), rss: Number(m[3]), elapsed: m[4], command: m[5] });
  }
  return rows;
}

function dirSizeMb(dir) {
  let total = 0;
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) { try { total += fs.statSync(p).size; } catch { /* 사라진 파일 */ } }
    }
  };
  walk(dir);
  return Math.round(total / 1024 / 1024);
}

if (process.argv[1] && /mcp-doctor\.mjs$/.test(process.argv[1])) {
  const i = process.argv.indexOf("--min-age");
  const minSeconds = i > -1 ? Number(process.argv[i + 1]) : 3600;
  const rows = psRows();
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(path.join(process.env.CLAUDE_PLUGIN_ROOT ?? path.resolve(new URL("../../..", import.meta.url).pathname), ".mcp.json"), "utf8")); } catch { /* 없으면 설정 점검 생략 */ }
  process.stdout.write(report({
    summary: summarize(rows),
    strays: findStrays(rows, { minSeconds }),
    npxCacheMb: dirSizeMb(path.join(os.homedir(), ".npm", "_npx")),
    findings: checkMcpConfig(cfg),
  }) + "\n");
}
