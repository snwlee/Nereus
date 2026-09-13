import { describe, it, expect } from "vitest";
import { DELEGATES, delegateRoutes, delegateStatus } from "../../plugins/nereus/hooks/scripts/lib/delegates.mjs";
import { routePrompt } from "../../plugins/nereus/hooks/scripts/lib/router.mjs";

const allPresent = { home: "/h", exists: () => true };
const nonePresent = { home: "/h", exists: () => false };

describe("외부 스킬 위임", () => {
  it("설치된 것만 라우트가 된다 — 없는 스킬을 부르라고 하면 죽은 지시다", () => {
    expect(delegateRoutes(allPresent).length).toBe(DELEGATES.length);
    expect(delegateRoutes(nonePresent)).toEqual([]);
  });

  it("스킬 디렉터리를 홈 밑에서 찾는다", () => {
    const seen: string[] = [];
    delegateRoutes({ home: "/h", exists: (p: string) => { seen.push(p); return false; } });
    expect(seen.some((p) => p.includes("/h") && p.includes("ad-video"))).toBe(true);
  });

  it("광고 영상 요청이 ad-video 로 간다", () => {
    const hits = routePrompt("광고 영상 하나 만들어줘", { extraRoutes: delegateRoutes(allPresent) });
    expect(hits.map((h: any) => h.skill)).toContain("ad-video");
  });

  it("영상 일반은 hyperframes 로 간다 — 공식 진입점이다", () => {
    const hits = routePrompt("이거 영상으로 만들자", { extraRoutes: delegateRoutes(allPresent) });
    expect(hits.map((h: any) => h.skill)).toContain("hyperframes");
  });

  it("코어 스킬을 밀어내지 않는다 — 디자인 요청은 여전히 nereus:design 이 먼저다", () => {
    const hits = routePrompt("이 화면 디자인 예쁘게 고쳐줘", { extraRoutes: delegateRoutes(allPresent) });
    expect(hits[0].skill).toBe("nereus:design");
  });

  it("이미지 생성은 가로채지 않는다 — nereus:image 가 이미 한다", () => {
    const hits = routePrompt("배너 이미지 만들어줘", { extraRoutes: delegateRoutes(allPresent) });
    expect(hits.map((h: any) => h.skill)).toContain("nereus:image");
    expect(hits.map((h: any) => h.skill)).not.toContain("ad-video");
  });

  it("상태표는 없는 것도 숨기지 않는다 — 감지 못 한 것과 없는 것은 다르다", () => {
    const rows = delegateStatus({ home: "/h", exists: (p: string) => p.includes("ad-video") });
    const byName = Object.fromEntries(rows.map((r: any) => [r.skill, r]));
    expect(byName["ad-video"].present).toBe(true);
    expect(byName["hyperframes"].present).toBe(false);
    // 마켓 설치 명령이 없는 종류다. 있는 척하지 않는다.
    expect(byName["hyperframes"].where).toContain("skills");
  });
});

// 배선 회귀: lib 만 초록이고 훅이 안 부르면 아무 일도 일어나지 않는다.
// 이 저장소에서 "선언했는데 아무도 안 쓰는 것"으로 세 번 물렸다.
import fs from "node:fs";
describe("배선", () => {
  for (const f of ["skill-router.mjs", "session-start.mjs"]) {
    it(`${f} 가 delegateRoutes 를 라우트에 합친다`, () => {
      const text = fs.readFileSync(`plugins/nereus/hooks/scripts/${f}`, "utf8");
      expect(text).toContain("delegateRoutes");
    });
  }
});
