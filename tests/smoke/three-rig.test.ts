import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const run = (s: string, input: string) =>
  execFileSync("node", [s], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
const SCAN = "plugins/nereus-3d/lib/scene-scan.mjs";
const BUDGET = "plugins/nereus-3d/lib/render-budget.mjs";

describe("nereus-3d 프로세스 리그", () => {
  it("정적 검사기를 프로세스로 돌린다", () => {
    const text = "function d(o){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); }\nd(x);";
    const out = run(SCAN, JSON.stringify({ sources: [{ file: "a.js", text }] }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("incomplete-dispose");
  });
  it("예산 검사기를 프로세스로 돌린다", () => {
    const out = run(BUDGET, JSON.stringify({
      samples: [{ label: "s", info: { render: { calls: 300, triangles: 1 }, memory: { geometries: 1, textures: 1 } } }],
      budgets: { calls: 100 },
    }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("budget-exceeded");
  });
  it("입력이 없어도 유효한 JSON 을 낸다 — 0바이트가 아니다", () => {
    for (const s of [SCAN, BUDGET]) {
      const out = run(s, "");
      expect(out.trim().length, s).toBeGreaterThan(0);
      expect(() => JSON.parse(out), s).not.toThrow();
    }
  });
  it("깨진 JSON 은 스택 프레임 없이 사유만 낸다", () => {
    for (const s of [SCAN, BUDGET]) {
      let failed = false;
      try { run(s, "{bad"); } catch (e: any) {
        failed = true;
        expect(e.status, s).not.toBe(0);
        expect(String(e.stderr), s).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
      }
      expect(failed, s).toBe(true);
    }
  });
});
