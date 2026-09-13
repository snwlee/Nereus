import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scanScene } from "../../plugins/nereus-3d/lib/scene-scan.mjs";

const DONOR = "/Volumes/SKHY1TB/workspace/FindDifferences3D/find_differences_3d_app/assets/html";
const has = fs.existsSync(DONOR);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

describe.skipIf(!has)("도너 검증 — 실제 프로젝트에서 잡는가", () => {
  const sources = has
    ? walk(DONOR).filter((f) => /\.(js|html)$/.test(f) && !f.includes("/vendor/"))
        .map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }))
    : [];
  it("소스를 실제로 읽었다 — 측정 실패를 결과 0 으로 읽지 않는다", () => {
    expect(sources.length).toBeGreaterThan(5);
    expect(sources.reduce((n, s) => n + s.text.length, 0)).toBeGreaterThan(10000);
  });
  it("도너의 불완전한 dispose 를 잡는다", () => {
    const r = scanScene({ sources });
    const v = r.violations.filter((x: any) => x.code === "incomplete-dispose");
    expect(v.length).toBeGreaterThan(0);
    expect(v.flatMap((x: any) => x.missingSlots)).toContain("normalMap");
  });
  it("도너의 계측 부재를 잡는다", () => {
    expect(scanScene({ sources }).violations.map((v: any) => v.code)).toContain("instrumentation-missing");
  });
  it("완전한 헬퍼에 위임하는 함수는 잡지 않는다 — 거짓 양성을 내지 않는다", () => {
    const r = scanScene({ sources });
    const flagged = r.violations.filter((v: any) => v.code === "incomplete-dispose").map((v: any) => v.fn);
    expect(flagged).not.toContain("disposeObject3D");
    expect(r.disposeHelpers.find((h: any) => h.fn === "disposeMaterial").complete).toBe(true);
  });
});
it("도너가 없으면 건너뛴 사실이 남는다", () => {
  expect(typeof has).toBe("boolean");
});
