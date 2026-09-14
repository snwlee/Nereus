import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const CLI = "plugins/nereus/skills/image/scripts/muapi-cli.mjs";
const run = (args: string[], env: Record<string, string> = {}) =>
  execFileSync("node", [CLI, ...args], {
    encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, MUAPI_API_KEY: "", ...env },
  });

describe("muapi CLI 리그", () => {
  it("능력별 개수를 키 없이도 낸다 — 카탈로그는 네트워크가 아니다", () => {
    const out = run(["summary", "--json"]);
    const j = JSON.parse(out);
    expect(j.t2v).toBeGreaterThan(0);
    expect(j.i2v).toBeGreaterThan(0);
  });
  it("능력의 모델 목록을 키 없이도 낸다", () => {
    const j = JSON.parse(run(["models", "t2v", "--json"]));
    expect(Array.isArray(j)).toBe(true);
    expect(j[0].endpoint).toBeTruthy();
  });
  it("모르는 능력은 스택 없이 사유만 내고 0 이 아닌 코드로 끝난다", () => {
    let failed = false;
    try { run(["models", "nope"]); } catch (e: any) {
      failed = true;
      expect(e.status).not.toBe(0);
      expect(String(e.stderr)).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
      expect(String(e.stderr)).toMatch(/능력/);
    }
    expect(failed).toBe(true);
  });
  it("키가 없으면 생성은 사유를 밝히고 멈춘다 — 조용히 죽지 않는다", () => {
    let failed = false;
    try { run(["generate", "--capability", "t2v", "--prompt", "x"]); } catch (e: any) {
      failed = true;
      expect(String(e.stderr)).toMatch(/MUAPI_API_KEY/);
    }
    expect(failed).toBe(true);
  });
  it("키 값을 어떤 출력에도 싣지 않는다", () => {
    let out = "";
    try { out = run(["generate", "--capability", "t2v", "--prompt", "x"], { MUAPI_API_KEY: "" }); }
    catch (e: any) { out = String(e.stderr) + String(e.stdout); }
    expect(out).not.toContain("SECRETVALUE");
  });
});
