import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { blockedReason, planSteps, scrapeEscalate } from "../../plugins/nereus/skills/research/scripts/scrape.mjs";

// 2026-11-12 스파이크(차단 사이트 6곳, 헤드리스, 사이트당 1~2회):
//   Scrapling fetch 4/6(재실행 동일) · CloakBrowser 2~3/6(glassdoor 재실행 시 차단) · Scrapling get 1/6(1.4s).
//   CloakBrowser 가 뚫고 Scrapling 이 못 뚫은 사이트는 없었다 → CloakBrowser 경로를 뺐다.
// 함정: scrapling 은 차단 화면을 받아도 종료 코드 0 이다(g2 → "Please enable JS ..."). 내용으로 판정해야 한다.

const long = (s: string) => s + " 본문".repeat(400);

describe("blockedReason — 받은 내용이 차단 화면인가", () => {
  it("실제로 받은 차단 화면들을 잡는다", () => {
    expect(blockedReason("Please enable JS and disable any ad blocker")).toMatch(/짧다|차단/);
    expect(blockedReason(long("nopecha.com 보안 확인 수행 중 이 웹 사이트는 보안 서비스를 사용하여"))).toMatch(/차단/);
    expect(blockedReason(long("Just a moment... Enable JavaScript and cookies to continue"))).toMatch(/차단/);
    expect(blockedReason(long("Access Denied You don't have permission"))).toMatch(/차단/);
  });
  it("짧은 응답은 본문으로 치지 않는다", () => {
    expect(blockedReason("")).toMatch(/짧다/);
    expect(blockedReason("x".repeat(200))).toMatch(/짧다/);
  });
  it("정상 본문은 통과한다 — 본문 뒤쪽의 'blocked' 같은 낱말로 막지 않는다", () => {
    const ok = "[Skip main navigation](#skip) Zillow Rentals Homes Agents Loans ".repeat(60) + " ad blocker settings";
    expect(blockedReason(ok)).toBeNull();
  });
});

describe("planSteps — 가벼운 것부터", () => {
  const s = planSteps("https://example.com/a", "out");
  it("get(브라우저 없음) 다음 fetch(스텔스 브라우저) 순서다", () => {
    expect(s.map((x: any) => x.method)).toEqual(["get", "fetch"]);
  });
  it("get 은 크롬 TLS 를 흉내 내고 본문만 Markdown 으로 받는다", () => {
    expect(s[0].args).toEqual(expect.arrayContaining(["extract", "get", "https://example.com/a", "--impersonate", "chrome", "--ai-targeted"]));
    expect(s[0].out).toMatch(/\.md$/);
  });
  it("fetch 는 Cloudflare 를 풀고 시간 제한이 있다", () => {
    expect(s[1].args).toEqual(expect.arrayContaining(["extract", "fetch", "--solve-cloudflare", "--ai-targeted", "--timeout"]));
    expect(s[1].timeoutMs).toBeGreaterThan(60000);
    expect(s[1].out).not.toBe(s[0].out);
  });
});

describe("scrapeEscalate — 막히면 한 단계 올린다", () => {
  const files: Record<string, string> = {};
  const deps = (results: Record<string, { status?: number; text?: string; error?: string }>) => ({
    available: () => true,
    run: (_bin: string, args: string[]) => {
      const method = args[1];
      const r = results[method] ?? {};
      if (r.text !== undefined) files[args[3]] = r.text;
      return r.error ? { ok: false, status: null, stderr: r.error } : { ok: (r.status ?? 0) === 0, status: r.status ?? 0, stderr: "" };
    },
    read: (p: string) => files[p] ?? null,
  });

  it("get 이 뚫으면 fetch 를 부르지 않는다", () => {
    const r = scrapeEscalate("https://z.com", "out", deps({ get: { text: long("Zillow homes") } }));
    expect(r).toMatchObject({ ok: true, method: "get" });
    expect(r.tried.map((t: any) => t.method)).toEqual(["get"]);
  });
  it("get 이 차단 화면이면 fetch 로 올린다(종료 코드 0 이어도)", () => {
    const r = scrapeEscalate("https://g.com", "out", deps({ get: { text: "Please enable JS and disable any ad blocker" }, fetch: { text: long("Glassdoor reviews") } }));
    expect(r).toMatchObject({ ok: true, method: "fetch" });
    expect(r.tried[0]).toMatchObject({ method: "get", ok: false });
  });
  it("둘 다 막히면 실패를 그대로 알린다 — 차단 화면을 자료로 넘기지 않는다", () => {
    const r = scrapeEscalate("https://c.com", "out", deps({ get: { text: "Access Denied" }, fetch: { error: "timeout" } }));
    expect(r.ok).toBe(false);
    expect(r.file).toBeNull();
    expect(r.tried.map((t: any) => t.reason).join(" ")).toMatch(/짧다|차단/);
    expect(r.tried[1].reason).toMatch(/timeout/);
  });
  it("scrapling 이 없으면 설치 안내와 함께 실패한다", () => {
    const r = scrapeEscalate("https://a.com", "out", { ...deps({}), available: () => false });
    expect(r.ok).toBe(false);
    expect(r.fix).toMatch(/scrapling\[fetchers,ai\]/);
    expect(r.tried).toEqual([]);
  });
});

describe("문서와 도구 목록", () => {
  const P = "plugins/nereus";
  it("research 는 CloakBrowser 대신 scrape.mjs 를 안내한다", () => {
    const t = fs.readFileSync(`${P}/skills/research/SKILL.md`, "utf8");
    expect(t).toMatch(/scrape\.mjs/);
    // 근거로 옛 경로 이름을 적는 것은 괜찮다. 쓰라는 지시(핀 변수·스크립트·섹션 제목)가 남으면 안 된다.
    expect(t).not.toMatch(/CLOAKBROWSER_|cloak\.mjs/);
    expect(t).not.toMatch(/## 2\.1[^\n]*CloakBrowser/);
    expect(fs.existsSync(`${P}/skills/research/scripts/cloak.mjs`)).toBe(false);
  });
  it("플러그인 어디에도 cloak 경로가 남지 않는다", () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (["node_modules", "__pycache__"].includes(e.name) ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]);
    const hits = walk(P).filter((f) => /\.(md|mjs|json)$/.test(f) && /CLOAKBROWSER_|cloak\.mjs|bin: "cloakbrowser"|npm\("cloakbrowser"\)/.test(fs.readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
