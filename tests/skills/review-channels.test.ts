import { describe, it, expect } from "vitest";
import fs from "node:fs";

// 스펙: openspec/changes/2026-11-12-egm-first-review (review-channels)
// 2026-11-12 사용자 방침 — 디자인 검토 1순위 impeccable, 제3자 검증 1순위 EGM(그것만으로 충분),
// Gemini 는 이 플러그인에서 무료 이미지 생성에만 쓴다. 문서가 옛 채널을 가리키면 에이전트는 그대로 따라간다.

const P = "plugins/nereus";
const read = (f: string) => fs.readFileSync(`${P}/${f}`, "utf8");

// 디자인 비평·리뷰 경로의 문서와 스크립트. 이미지·영상·몽타주·setup 의 쿠키 안내는 대상이 아니다.
const REVIEW_PATH_FILES = [
  "skills/design/SKILL.md",
  "skills/review/SKILL.md",
  "skills/build/SKILL.md",
  "skills/common/SKILL.md",
  "skills/spec/SKILL.md",
  "agents/architect.md",
  "agents/frontend.md",
  "agents/reviewer.md",
  "skills/finish/scripts/gate.mjs",
  "skills/finish/SKILL.md",
  "hooks/scripts/finish-check.mjs",
  "skills/design/scripts/motion-check.mjs",
];

// EGM 리뷰 [HIGH] (2026-11-12): frontend·app 에이전트가 없어진 직접 실행 명령을 그대로 지시하고 있었다.
describe("없어진 디자인 명령을 지시하지 않는다", () => {
  const all = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === "node_modules" || e.name === "__pycache__" ? [] : all(`${dir}/${e.name}`)) : [`${dir}/${e.name}`]);
  const docs = all(P).filter((f) => /\.(md|mjs)$/.test(f));
  it("design-feedback.mjs direction|visual 직접 실행 지시가 없다 (record 를 거친다)", () => {
    const hits = docs.filter((f) => /design-feedback\.mjs[`"]?\s+(direction|visual)\b/.test(fs.readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("디자인·리뷰 경로에 Gemini·agy 가 없다", () => {
  for (const f of REVIEW_PATH_FILES) {
    it(f, () => {
      const t = read(f);
      expect(t).not.toMatch(/Gemini/i);
      expect(t).not.toMatch(/\bagy\b/);
    });
  }
});

describe("새 채널을 가리킨다", () => {
  it("design 스킬은 impeccable 의 shape·critique 와 옮기는 형식을 안내한다", () => {
    const t = read("skills/design/SKILL.md");
    expect(t).toMatch(/impeccable/);
    expect(t).toMatch(/shape/);
    expect(t).toMatch(/critique/);
    expect(t).toMatch(/P1[^\n]*\[HIGH\]/);
    expect(t).toMatch(/record visual/);
  });
  it("review 스킬은 EGM 을 기본 2차 의견으로, 대화 맥락 없이 띄우라고 안내한다", () => {
    const t = read("skills/review/SKILL.md");
    expect(t).toMatch(/EGM/);
    expect(t).toMatch(/egmPersonas/);
    expect(t).toMatch(/맥락/);
    expect(t).toMatch(/"codex"/);
  });
  // EGM 리뷰 [MEDIUM]: 리뷰는 커밋 전에 돈다 — 커밋 범위만 보라고 하면 아무것도 안 본다. 페르소나 심각도는 Blocker/Major/Nit 다.
  it("EGM 프롬프트는 미커밋 변경도 보게 하고 심각도 매핑을 고정한다", () => {
    const t = read("skills/review/SKILL.md");
    expect(t).toMatch(/git status --porcelain/);
    expect(t).toMatch(/Blocker\s*→\s*CRITICAL/);
    expect(t).toMatch(/Major\s*→\s*HIGH/);
  });
  it("setup 이 만드는 설정 템플릿도 egm 이다", () => {
    expect(read("skills/setup/SKILL.md")).not.toMatch(/"secondOpinion":\s*"both"/);
  });
  it("design 스킬은 impeccable 원본 보고서를 --report 로 함께 기록하게 한다", () => {
    expect(read("skills/design/SKILL.md")).toMatch(/--report/);
  });
  it("setup 은 secondOpinion 기본을 egm 으로 설명한다", () => {
    const t = read("skills/setup/SKILL.md");
    expect(t).toMatch(/`"egm"`\(기본/);
    expect(t).not.toMatch(/`"both"`\(기본\)/);
  });
  it("image 스킬은 여전히 Gemini 웹세션을 쓴다 — 무료 이미지 생성은 유지", () => {
    expect(read("skills/image/SKILL.md")).toMatch(/Gemini/);
  });
});
