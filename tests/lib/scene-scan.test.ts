import { describe, it, expect } from "vitest";
import { scanScene } from "../../plugins/nereus-3d/lib/scene-scan.mjs";

const codes = (r: any) => r.violations.map((v: any) => v.code);

const MAP_ONLY = `function disposeSubtree(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map && child.material.map.dispose) child.material.map.dispose();
      child.material.dispose();
    }
  });
}
disposeSubtree(root);`;

const SWEEP = `function disposeMaterial(material) {
  for (const key in material) {
    const value = material[key];
    if (value && value.isTexture) value.dispose();
  }
  material.dispose();
}
disposeMaterial(m);`;

describe("불완전한 dispose", () => {
  it("map 만 정리하면 잡는다 — 나머지 슬롯은 GPU 에 남는다", () => {
    const r = scanScene({ sources: [{ file: "a.js", text: MAP_ONLY }] });
    const v = r.violations.find((x: any) => x.code === "incomplete-dispose");
    expect(v.missingSlots).toContain("normalMap");
    expect(v.missingSlots).not.toContain("map");
  });
  it("속성을 순회하면 통과한다 — 새 슬롯이 추가돼도 덮인다", () => {
    const r = scanScene({ sources: [{ file: "b.js", text: SWEEP }] });
    expect(codes(r)).not.toContain("incomplete-dispose");
  });
  it("지오메트리만 정리하는 함수는 대상이 아니다", () => {
    const text = `function f(o){ o.geometry.dispose(); }\nf(x);`;
    const r = scanScene({ sources: [{ file: "c.js", text }] });
    expect(codes(r)).not.toContain("incomplete-dispose");
  });
  it("정규식 기반임을 항상 밝힌다", () => {
    const r = scanScene({ sources: [] });
    expect(r.unmeasured.map((u: any) => u.what).join(" ")).toMatch(/파서/);
    for (const u of r.unmeasured) expect(u.why.length).toBeGreaterThan(0);
  });
});

const DELEGATES = `function disposeMaterial(material) {
  for (const key in material) {
    const value = material[key];
    if (value && value.isTexture) value.dispose();
  }
  material.dispose();
}
function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
      else disposeMaterial(child.material);
    }
  });
}
disposeObject3D(root);`;

describe("위임", () => {
  it("완전한 헬퍼에 위임하면 통과한다 — 호출 지점을 보기 전에 결함이라 부르지 않는다", () => {
    const r = scanScene({ sources: [{ file: "a.js", text: DELEGATES }] });
    expect(codes(r)).not.toContain("incomplete-dispose");
  });
  it("다른 파일의 완전한 헬퍼에 위임해도 통과한다", () => {
    const helper = `function disposeMaterial(m) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); }`;
    const caller = `function disposeSubtree(o) { o.traverse((c) => { if (c.material) disposeMaterial(c.material); if (c.geometry) c.geometry.dispose(); }); }\ndisposeSubtree(root);`;
    const r = scanScene({ sources: [{ file: "h.js", text: helper }, { file: "c.js", text: caller }] });
    expect(codes(r)).not.toContain("incomplete-dispose");
  });
  it("불완전한 헬퍼에 위임하면 여전히 잡는다", () => {
    const helper = `function disposeMaterial(m) { if (m.map) m.map.dispose(); m.dispose(); }`;
    const caller = `function disposeSubtree(o) { o.traverse((c) => { if (c.material) disposeMaterial(c.material); }); }\ndisposeSubtree(root);`;
    const r = scanScene({ sources: [{ file: "h.js", text: helper }, { file: "c.js", text: caller }] });
    expect(codes(r)).toContain("incomplete-dispose");
  });
});

describe("배선과 계측", () => {
  it("정의만 되고 호출이 없으면 잡는다", () => {
    const text = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }`;
    const r = scanScene({ sources: [{ file: "a.js", text }] });
    const v = r.violations.find((x: any) => x.code === "dispose-unwired");
    expect(v.fn).toBe("disposeAll");
  });
  it("자기 정의 밖에서 호출되면 통과한다", () => {
    const text = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }\ndisposeAll(root);`;
    const r = scanScene({ sources: [{ file: "a.js", text }] });
    expect(codes(r)).not.toContain("dispose-unwired");
  });
  it("다른 파일에서 호출돼도 통과한다", () => {
    const a = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }`;
    const r = scanScene({ sources: [{ file: "a.js", text: a }, { file: "b.js", text: "disposeAll(root);" }] });
    expect(codes(r)).not.toContain("dispose-unwired");
  });
  it("호출 지점 수를 같이 낸다", () => {
    const a = `function disposeAll(o){ for (const key in o) { const v=o[key]; if (v && v.isTexture) v.dispose(); } o.dispose(); }\ndisposeAll(a);\ndisposeAll(b);`;
    const r = scanScene({ sources: [{ file: "a.js", text: a }] });
    expect(r.disposeHelpers.find((h: any) => h.fn === "disposeAll").callSites).toBe(2);
  });
  it("renderer.info 를 아무도 안 읽으면 잡는다 — 측정 자체가 불가능하다", () => {
    const r = scanScene({ sources: [{ file: "a.js", text: "const x = 1;" }] });
    expect(codes(r)).toContain("instrumentation-missing");
  });
  it("한 곳이라도 읽으면 통과한다", () => {
    const r = scanScene({ sources: [{ file: "a.js", text: "console.log(renderer.info.render.calls);" }] });
    expect(codes(r)).not.toContain("instrumentation-missing");
  });
});
