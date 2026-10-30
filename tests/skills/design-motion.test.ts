import { describe, it, expect } from "vitest";
import { checkMotion, motionReport, MOTION_RULES } from "../../plugins/nereus/skills/design/scripts/motion-check.mjs";

const diff = (file: string, added: string[], { start = 1, extra = [] as string[] } = {}) => [
  `diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`,
  `@@ -${start},0 +${start},${added.length + extra.length} @@`,
  ...extra, ...added.map((l) => `+${l}`),
].join("\n");
const rules = (d: string) => checkMotion(d).map((f) => f.rule);

describe("design-motion.rules", () => {
  it("transition all — 파일·줄 번호", () => {
    const f = checkMotion(diff("src/a.css", [".a {", "  transition: all 300ms ease;", "}"], { start: 4 }));
    expect(f).toContainEqual(expect.objectContaining({ file: "src/a.css", line: 5, rule: "transition-all" }));
  });
  it("tailwind 클래스 transition-all·scale-0·duration-700", () => {
    const r = rules(diff("src/A.tsx", ['<div className="transition-all scale-0 duration-700 motion-reduce:transition-none" />']));
    expect(r).toEqual(expect.arrayContaining(["transition-all", "scale-zero", "long-duration"]));
    expect(r).not.toContain("no-reduced-motion");
  });
  it("레이아웃 속성 전환", () => {
    expect(rules(diff("a.css", ["  transition: width 200ms ease-out, opacity 200ms;"]))).toContain("layout-prop");
    expect(rules(diff("a.css", ["  transition-property: margin-left;"]))).toContain("layout-prop");
    expect(rules(diff("A.tsx", ['<i className="transition-[height] duration-200" />']))).toContain("layout-prop");
    expect(rules(diff("a.css", ["  transition: transform 200ms ease-out;"]))).not.toContain("layout-prop");
  });
  it("scale(0)", () => {
    expect(rules(diff("a.css", ["  transform: scale(0);"]))).toContain("scale-zero");
    expect(rules(diff("a.css", ["  transform: scale(0.95);"]))).not.toContain("scale-zero");
  });
  it("ease-in 은 잡고 ease-in-out 은 통과", () => {
    expect(rules(diff("a.css", ["  transition: opacity 200ms ease-in;"]))).toContain("ease-in");
    expect(rules(diff("a.css", ["  transition: transform 200ms ease-in-out;"]))).not.toContain("ease-in");
  });
  it("길이 — 500ms 초과·0.5s 초과", () => {
    expect(rules(diff("a.css", ["  transition: opacity 600ms ease-out;"]))).toContain("long-duration");
    expect(rules(diff("a.css", ["  animation: spin 1.2s linear infinite;"]))).toContain("long-duration");
    expect(rules(diff("a.css", ["  transition: opacity 200ms ease-out;"]))).not.toContain("long-duration");
  });
  it("reduced-motion — 없으면 파일당 한 번, 있으면 통과", () => {
    const none = checkMotion(diff("a.css", ["  transition: opacity 200ms ease-out;", "  animation: fade 200ms ease-out;"]));
    expect(none.filter((f) => f.rule === "no-reduced-motion")).toHaveLength(1);
    const ok = diff("a.css", ["  transition: opacity 200ms ease-out;"], { extra: [" @media (prefers-reduced-motion: reduce) { * { transition: none } }"] });
    expect(rules(ok)).not.toContain("no-reduced-motion");
  });
  it("저장소에 전역 reduced-motion 이 있으면 파일마다 묻지 않는다", () => {
    const d = diff("a.css", ["  transition: opacity 200ms ease-out;"]);
    expect(rules(d)).toContain("no-reduced-motion");
    expect(checkMotion(d, { reducedMotionHandled: true }).map((f) => f.rule)).not.toContain("no-reduced-motion");
  });
  it("삭제 줄·대상 외 확장자는 무시", () => {
    expect(checkMotion(["diff --git a/a.css b/a.css", "+++ b/a.css", "@@ -1,1 +0,0 @@", "-  transition: all 1s;"].join("\n"))).toEqual([]);
    expect(checkMotion(diff("a.ts", ["const s = 'transition: all 1s';"]))).toEqual([]);
  });
});

describe("design-motion.cli", () => {
  it("보고서", () => {
    expect(motionReport([])).toContain("모션 지적 없음");
    const md = motionReport([{ file: "a.css", line: 3, rule: "transition-all", message: "m" }]);
    expect(md).toContain("transition-all");
    expect(md).toContain("a.css:3");
  });
  it("규칙마다 설명이 있다", () => {
    for (const r of ["transition-all", "layout-prop", "scale-zero", "ease-in", "long-duration", "no-reduced-motion"])
      expect(MOTION_RULES[r]).toBeTruthy();
  });
});
