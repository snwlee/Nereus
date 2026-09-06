import { describe, it, expect } from "vitest";
import { ROUTES, routePrompt, routerNotice, skillMapBlock } from "../../plugins/nereus/hooks/scripts/lib/router.mjs";

describe("ROUTES", () => {
  it("has a unique skill per route and a reason for each", () => {
    const skills = ROUTES.map((r) => r.skill);
    expect(new Set(skills).size).toBe(skills.length);
    for (const r of ROUTES) {
      expect(r.skill).toMatch(/^nereus:[a-z0-9-]+$/);
      expect(r.why.length).toBeGreaterThan(3);
    }
  });
});

describe("routePrompt", () => {
  const skills = (t: string, opts?: any) => routePrompt(t, opts).map((h) => h.skill);

  it("routes bug reports to debug", () => {
    expect(skills("로그인하면 에러가 나")).toContain("nereus:debug");
    expect(skills("테스트가 실패해")).toContain("nereus:debug");
    expect(skills("이게 왜 안 되지")).toContain("nereus:debug");
    expect(skills("빌드가 깨졌어")).toContain("nereus:debug");
  });
  it("routes design work to design", () => {
    expect(skills("이 화면 좀 예쁘게 해줘")).toContain("nereus:design");
    expect(skills("버튼 스타일 수정")).toContain("nereus:design");
    expect(skills("UI 레이아웃 바꿔줘")).toContain("nereus:design");
  });
  it("routes a new feature request to intake", () => {
    expect(skills("결제 기능 개발해줘")).toContain("nereus:intake");
    expect(skills("새 프로젝트 시작하자")).toContain("nereus:intake");
  });
  it("routes review, finish and e2e asks", () => {
    expect(skills("코드 리뷰해줘")).toContain("nereus:review");
    expect(skills("커밋하고 마무리해")).toContain("nereus:finish");
    expect(skills("E2E 돌려봐")).toContain("nereus:e2e");
  });
  it("returns nothing for a prompt with no workflow signal", () => {
    expect(routePrompt("고마워")).toEqual([]);
    expect(routePrompt("")).toEqual([]);
    expect(routePrompt(null as any)).toEqual([]);
  });
  it("caps the number of suggestions so the notice stays one line", () => {
    const many = "에러가 나는 UI 화면을 개발해줘. 리뷰하고 커밋하고 E2E 도 돌려";
    expect(routePrompt(many).length).toBeLessThanOrEqual(2);
  });
  it("drops skills already suggested this session", () => {
    expect(skills("에러가 나", { seen: ["nereus:debug"] })).not.toContain("nereus:debug");
  });
  it("keeps debug ahead of other matches because process skills come first", () => {
    const hits = routePrompt("UI 화면에서 에러가 나");
    expect(hits[0].skill).toBe("nereus:debug");
  });
  it("does not fire on a mere mention inside a path or identifier", () => {
    expect(skills("src/error/handler.ts 파일을 열어줘")).not.toContain("nereus:debug");
  });
});

describe("routerNotice", () => {
  it("names the skill and demands invocation before acting", () => {
    const n = routerNotice([{ skill: "nereus:debug", why: "버그·실패" }]);
    expect(n).toContain("nereus:debug");
    expect(n).toMatch(/Skill/);
    expect(n.split("\n").length).toBeLessThanOrEqual(3);
  });
  it("returns an empty string for no hits", () => {
    expect(routerNotice([])).toBe("");
  });
});

describe("skillMapBlock", () => {
  it("lists every route once, compactly", () => {
    const b = skillMapBlock();
    for (const r of ROUTES) expect(b).toContain(r.skill);
    expect(b.length).toBeLessThan(1600); // SessionStart 예산: 항상 주입되므로 짧아야 한다
  });
});

describe("routePrompt — 오탐 방지", () => {
  const skills = (t: string) => routePrompt(t).map((h) => h.skill);

  it("'만들어줘' 만으로 intake 를 물지 않는다 — 기능·프로젝트 규모여야 한다", () => {
    expect(skills("이 화면 좀 예쁘게 만들어줘")).not.toContain("nereus:intake");
    expect(skills("아이콘 만들어줘")).not.toContain("nereus:intake");
    expect(skills("결제 기능 만들어줘")).toContain("nereus:intake");
    expect(skills("새 앱 만들어줘")).toContain("nereus:intake");
  });
  it("'봐 줘' 만으로 review 를 물지 않는다", () => {
    expect(skills("이 로그 좀 봐 줘")).not.toContain("nereus:review");
    expect(skills("코드 리뷰해 줘")).toContain("nereus:review");
  });
  it("디자인 요청은 design 하나로 충분하다", () => {
    expect(skills("이 화면 좀 예쁘게 만들어줘")).toEqual(["nereus:design"]);
  });
});
