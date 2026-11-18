import { describe, it, expect } from "vitest";
import fs from "node:fs";

const VIDEO = "plugins/nereus/skills/video/SKILL.md";
const FX = "plugins/nereus/skills/design/references/web-effect-repos.md";
const DESIGN = "plugins/nereus/skills/design/SKILL.md";

describe("영상 프롬프트 자료실", () => {
  it("세 곳을 출처로 건다", () => {
    const t = fs.readFileSync(VIDEO, "utf8");
    for (const s of ["vvsvs.pro", "seedance-emotion-direction", "youmind.com"]) expect(t, s).toContain(s);
  });
  it("본문을 복사하지 않는다고 못박는다", () => {
    expect(fs.readFileSync(VIDEO, "utf8")).toMatch(/복사하지 않는다/);
  });
  it("Seedance 가 카탈로그에 실제로 있어서 건 것임을 밝힌다", () => {
    expect(fs.readFileSync(VIDEO, "utf8")).toMatch(/seedance/i);
  });
});

describe("웹 이펙트 저장소", () => {
  it("design 스킬이 가리킨다 — nereus-3d 가 아니다", () => {
    expect(fs.existsSync(FX)).toBe(true);
    expect(fs.readFileSync(DESIGN, "utf8")).toContain("web-effect-repos.md");
  });
  it("네 개 전부 라이선스를 적는다", () => {
    const t = fs.readFileSync(FX, "utf8");
    for (const r of ["liquid-glass-js", "liquid-logo", "shadergradient", "threejs-journey"]) expect(t, r).toContain(r);
    expect(t).toMatch(/MIT/);
    expect(t).toMatch(/NOASSERTION|라이선스 없음|없다/);
  });
  it("라이선스 없는 것을 채택 가능으로 적지 않는다", () => {
    const t = fs.readFileSync(FX, "utf8");
    const sg = t.slice(t.indexOf("shadergradient"), t.indexOf("shadergradient") + 400);
    expect(sg).toMatch(/없|불가|금지/);
  });
  it("three.js 검사기와 혼동하지 않게 경계를 적는다", () => {
    expect(fs.readFileSync(FX, "utf8")).toMatch(/nereus-3d/);
  });
});

const MOTION = "plugins/nereus/skills/design/references/motion-refs.md";

describe("모션 레퍼런스 목록", () => {
  it("design 스킬이 가리킨다 — 스킬이 아니라 참고 목록이다", () => {
    expect(fs.existsSync(MOTION)).toBe(true);
    expect(fs.readFileSync(DESIGN, "utf8")).toContain("motion-refs.md");
  });
  it("세 출처를 라이선스와 함께 적는다", () => {
    const t = fs.readFileSync(MOTION, "utf8");
    for (const s of ["designbookmark.com/motion", "kokonutui", "smoothui"]) expect(t, s).toContain(s);
    expect(t).toMatch(/MIT/);
  });
  it("라이선스 없는 DesignBookmark 코드를 복사 가능으로 적지 않는다", () => {
    const t = fs.readFileSync(MOTION, "utf8");
    const i = t.indexOf("designbookmark.com/motion");
    expect(t.slice(i, i + 400)).toMatch(/없|불가|금지|보기만/);
  });
  it("에이전트가 라이브 데모를 볼 수 없다는 한계를 적는다", () => {
    expect(fs.readFileSync(MOTION, "utf8")).toMatch(/사람이 (본다|고른다)|라이브/);
  });
  it("역할별 스프링 프리셋을 수치로 적고, 수치만 옮겼다고 밝힌다", () => {
    const t = fs.readFileSync(MOTION, "utf8");
    for (const s of ["900/50", "280/22", "260/24", "620/36", "190/19", "520/16", "420/32"]) expect(t, s).toContain(s);
    expect(t).toMatch(/코드는 옮기지 않/);
  });
});
