import { describe, it, expect } from "vitest";
import { classify, summarize, findStrays, checkMcpConfig, report } from "../../plugins/nereus/skills/setup/scripts/mcp-doctor.mjs";

const row = (pid: number, ppid: number, rssKb: number, elapsed: string, command: string) => ({ pid, ppid, rss: rssKb, elapsed, command });

describe("classify", () => {
  it("splits the browser MCP family into server, telemetry watchdog and real Chrome", () => {
    expect(classify("node /x/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js")).toBe("browser MCP");
    expect(classify("node /x/chrome-devtools-mcp/build/src/telemetry/watchdog/main.js --parent-pid=1")).toBe("browser 텔레메트리");
    expect(classify("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/x/chrome-devtools-mcp-profile")).toBe("Chrome");
  });
  it("recognizes context7 and the npx wrapper", () => {
    expect(classify("node /x/@upstash/context7-mcp/dist/index.js")).toBe("context7 MCP");
    expect(classify("node /opt/lib/node_modules/npm/bin/npm-cli.js exec -- chrome-devtools-mcp@latest")).toBe("npx 래퍼");
  });
  it("returns null for unrelated processes", () => {
    expect(classify("/usr/bin/ssh-agent -l")).toBeNull();
    expect(classify("")).toBeNull();
  });
});

describe("summarize", () => {
  it("aggregates RSS and count per family, largest first", () => {
    const s = summarize([
      row(1, 0, 40 * 1024, "01:00", "node /x/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js"),
      row(2, 1, 50 * 1024, "01:00", "node /x/chrome-devtools-mcp/build/src/telemetry/watchdog/main.js"),
      row(3, 0, 30 * 1024, "01:00", "node /x/@upstash/context7-mcp/dist/index.js"),
      row(4, 0, 10 * 1024, "01:00", "/usr/bin/unrelated"),
    ]);
    expect(s.families[0]).toMatchObject({ family: "browser 텔레메트리", mb: 50, count: 1 });
    expect(s.totalMb).toBe(120);
    expect(s.families.map((f: any) => f.family)).not.toContain(null);
  });
  it("returns an empty summary when nothing matches", () => {
    expect(summarize([row(1, 0, 100, "01:00", "/usr/bin/unrelated")])).toMatchObject({ families: [], totalMb: 0 });
  });
});

describe("findStrays", () => {
  it("flags reparented MCP processes older than the threshold", () => {
    const strays = findStrays([
      row(10, 1, 20 * 1024, "6-16:08:09", "node /x/@upstash/context7-mcp/dist/index.js"),
      row(11, 1, 20 * 1024, "00:30", "node /x/@upstash/context7-mcp/dist/index.js"),
      row(12, 99, 20 * 1024, "6-16:08:09", "node /x/@upstash/context7-mcp/dist/index.js"),
    ], { minSeconds: 3600 });
    expect(strays.map((s: any) => s.pid)).toEqual([10]);
    expect(strays[0].ageSeconds).toBeGreaterThan(500000);
  });
  it("parses every ps elapsed format", () => {
    const parsed = findStrays([
      row(1, 1, 1024, "12:34", "node /x/@upstash/context7-mcp/dist/index.js"),
      row(2, 1, 1024, "1:02:03", "node /x/@upstash/context7-mcp/dist/index.js"),
      row(3, 1, 1024, "2-03:04:05", "node /x/@upstash/context7-mcp/dist/index.js"),
    ], { minSeconds: 0 }).map((s: any) => s.ageSeconds);
    expect(parsed).toEqual([754, 3723, 183845]);
  });
});

describe("checkMcpConfig", () => {
  const pinned = {
    mcpServers: {
      browser: { command: "npx", args: ["-y", "chrome-devtools-mcp@1.8.0"], env: { CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1" } },
      context7: { command: "npx", args: ["-y", "@upstash/context7-mcp@4.0.5"] },
    },
  };

  it("passes a pinned config with telemetry disabled", () => {
    expect(checkMcpConfig(pinned)).toEqual([]);
  });
  it("flags @latest because it hits the registry every session and grows the npx cache", () => {
    const f = checkMcpConfig({ mcpServers: { browser: { command: "npx", args: ["-y", "chrome-devtools-mcp@latest"] } } });
    expect(f.some((x: any) => x.category === "unpinned" && x.server === "browser")).toBe(true);
  });
  it("flags a browser server without the telemetry opt-out", () => {
    const f = checkMcpConfig({ mcpServers: { browser: { command: "npx", args: ["-y", "chrome-devtools-mcp@1.8.0"] } } });
    expect(f.some((x: any) => x.category === "telemetry_on")).toBe(true);
  });
  it("says nothing about a config with no servers", () => {
    expect(checkMcpConfig({})).toEqual([]);
    expect(checkMcpConfig(null)).toEqual([]);
  });
});

describe("report", () => {
  it("renders families, strays, cache size and how to disable a server", () => {
    const md = report({
      summary: { families: [{ family: "browser MCP", mb: 300, count: 9 }], totalMb: 300 },
      strays: [{ pid: 10, family: "context7 MCP", mb: 20, ageSeconds: 580000 }],
      npxCacheMb: 1024,
      findings: [{ category: "unpinned", server: "browser", message: "@latest" }],
    });
    expect(md).toContain("browser MCP");
    expect(md).toContain("300MB");
    expect(md).toContain("10");                       // 고아 pid
    expect(md).toContain("1024MB");                   // npx 캐시
    expect(md).toContain("deniedMcpServers");         // 끄는 방법
    expect(md).toContain("plugin:nereus:browser");
  });
  it("stays short and calm when everything is fine", () => {
    const md = report({ summary: { families: [], totalMb: 0 }, strays: [], npxCacheMb: 12, findings: [] });
    expect(md).toMatch(/문제\s?없음|정상/);
    expect(md.split("\n").length).toBeLessThan(12);
  });
});

describe("classify — nereus 소유가 아닌 MCP", () => {
  it("사용자 전역 MCP 도 계열로 잡되 소유를 표시한다", () => {
    expect(classify("node /x/codegraph-mcp/dist/server.js")).toBe("기타 MCP(사용자 설정)");
    expect(classify("python3 -m credstore.mcp")).toBe("기타 MCP(사용자 설정)");
  });
  it("nereus 서버가 기타로 분류되지 않는다", () => {
    expect(classify("node /x/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js")).toBe("browser MCP");
  });
});

describe("findStrays — 전역 MCP 도 포함", () => {
  it("6일 떠 있는 고아 codegraph 도 유령으로 잡는다", () => {
    const s = findStrays([row(9, 1, 118 * 1024, "6-16:00:40", "node /x/codegraph-mcp/dist/server.js")], { minSeconds: 3600 });
    expect(s[0]).toMatchObject({ pid: 9, family: "기타 MCP(사용자 설정)", mb: 118 });
  });
});
