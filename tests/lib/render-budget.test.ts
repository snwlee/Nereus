import { describe, it, expect } from "vitest";
import { checkRenderBudget } from "../../plugins/nereus-3d/lib/render-budget.mjs";

const codes = (r: any) => r.violations.map((v: any) => v.code);
const info = (calls: number, geometries: number) =>
  ({ render: { calls, triangles: 1000 }, memory: { geometries, textures: 4 }, programs: 3 });

describe("렌더 예산", () => {
  it("상한을 넘으면 잡는다", () => {
    const r = checkRenderBudget({ samples: [{ label: "s1", info: info(300, 10) }], budgets: { calls: 100 } });
    const v = r.violations.find((x: any) => x.code === "budget-exceeded");
    expect(v.axis).toBe("calls");
    expect(v.value).toBe(300);
    expect(v.limit).toBe(100);
  });
  it("상한 이하면 통과한다", () => {
    const r = checkRenderBudget({ samples: [{ label: "s1", info: info(50, 10) }], budgets: { calls: 100 } });
    expect(codes(r)).not.toContain("budget-exceeded");
  });
  it("기준이 없으면 판정하지 않고 그 사실을 싣는다", () => {
    const r = checkRenderBudget({ samples: [{ label: "s1", info: info(9999, 10) }] });
    expect(r.violations).toEqual([]);
    expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/예산/);
  });
  it("증거가 없으면 던지지 않는다", () => {
    const r = checkRenderBudget({ budgets: { calls: 100 } });
    expect(r.violations).toEqual([]);
    expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/표본/);
  });
  it("같은 라벨에서 늘면 누수로 본다", () => {
    const r = checkRenderBudget({ samples: [
      { label: "scene-1", info: info(50, 120) },
      { label: "scene-1", info: info(50, 240) },
    ] });
    const v = r.violations.find((x: any) => x.code === "leak-suspected");
    expect(v.axis).toBe("geometries");
    expect(v.from).toBe(120);
    expect(v.to).toBe(240);
  });
  it("같은 라벨에서 안 늘면 통과한다", () => {
    const r = checkRenderBudget({ samples: [
      { label: "scene-1", info: info(50, 120) },
      { label: "scene-1", info: info(50, 120) },
    ] });
    expect(codes(r)).not.toContain("leak-suspected");
  });
  it("표본이 하나뿐이면 누수를 판정하지 않는다 — 수가 큰 것은 큰 씬일 수 있다", () => {
    const r = checkRenderBudget({ samples: [{ label: "scene-1", info: info(50, 99999) }] });
    expect(codes(r)).not.toContain("leak-suspected");
    expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/누수/);
  });
});
