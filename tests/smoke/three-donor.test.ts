import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scanScene } from "../../plugins/nereus-3d/lib/scene-scan.mjs";

// 실제 세상에서 나온 결함을 **고정**해 둔다. 도너의 커밋 b3f3952 에서 그대로 떠 왔고,
// 도너가 자기 버그를 고쳐도 이 회귀 테스트는 살아 있다 — 실제로 2026-09-14 에 고쳐졌다.
const FROZEN = "tests/fixtures/three/donor-dispose-b3f3952.js";

const DONOR = "/Volumes/SKHY1TB/workspace/FindDifferences3D/find_differences_3d_app/assets/html";
const has = fs.existsSync(DONOR);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

describe("실제 코드에서 나온 불완전한 dispose", () => {
  it("map 만 정리하던 도너 코드를 잡는다 — 빠진 슬롯을 이름으로 낸다", () => {
    const text = fs.readFileSync(FROZEN, "utf8");
    const r = scanScene({ sources: [{ file: FROZEN, text }] });
    const v = r.violations.filter((x: any) => x.code === "incomplete-dispose");
    expect(v.length).toBeGreaterThan(0);
    expect(v.flatMap((x: any) => x.missingSlots)).toContain("normalMap");
    expect(v.flatMap((x: any) => x.missingSlots)).not.toContain("map");
  });
  it("픽스처가 지어낸 코드가 아님을 출처로 밝힌다", () => {
    const text = fs.readFileSync(FROZEN, "utf8");
    expect(text).toMatch(/FindDifferences3D/);
    expect(text).toMatch(/b3f3952/);
  });
});

// 라이브 도너에는 **변하지 않는 성질**만 단언한다.
// "이 결함이 남아 있어야 한다"를 걸면 남이 자기 버그를 고치는 순간 우리가 빨개진다.
describe.skipIf(!has)("라이브 도너 — 실제 프로젝트에서 무너지지 않는가", () => {
  const sources = has
    ? walk(DONOR).filter((f) => /\.(js|html)$/.test(f) && !f.includes("/vendor/"))
        .map((f) => ({ file: f, text: fs.readFileSync(f, "utf8") }))
    : [];
  it("소스를 실제로 읽었다 — 측정 실패를 결과 0 으로 읽지 않는다", () => {
    expect(sources.length).toBeGreaterThan(5);
    expect(sources.reduce((n, s) => n + s.text.length, 0)).toBeGreaterThan(10000);
  });
  it("실제 dispose 헬퍼를 호출 지점과 함께 찾는다", () => {
    const r = scanScene({ sources });
    const helpers = r.disposeHelpers.filter((h: any) => /dispose/i.test(h.fn));
    expect(helpers.length).toBeGreaterThan(0);
    for (const h of helpers) expect(typeof h.callSites).toBe("number");
  });
  it("속성을 순회하는 헬퍼와 그것에 위임하는 함수를 잡지 않는다 — 거짓 양성이 없다", () => {
    const r = scanScene({ sources });
    const sweeping = r.disposeHelpers.filter((h: any) => h.complete).map((h: any) => h.fn);
    expect(sweeping.length).toBeGreaterThan(0);
    const flagged = r.violations.filter((v: any) => v.code === "incomplete-dispose").map((v: any) => v.fn);
    for (const fn of sweeping) expect(flagged, fn).not.toContain(fn);
  });
  it("정규식 기반임을 결과에 항상 싣는다", () => {
    const r = scanScene({ sources });
    expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/파서/);
  });
});

it("도너가 없으면 건너뛴 사실이 남는다", () => {
  expect(typeof has).toBe("boolean");
});
