// ASO 로케일 우선순위 **조언자**. 게이트가 아니다.
// 어느 로케일을 먼저 채울지는 사업 판단이고, 하네스가 강제하면 하네스가 사업을 결정하게 된다.
// (nereus-game:track · nereus-ads:ad-funnel 과 같은 규율이다.)
import { describe, it, expect } from "vitest";
import { adviseAso } from "../../plugins/nereus-l10n/lib/aso-advisor.mjs";

const coverage = { store: "play", required: 86, present: 2, missing: ["pt-BR", "fr-FR", "de-DE"], skipped: [] };

describe("ASO 조언자", () => {
  it("게이트가 아니다 — violations 를 내지 않는다", () => {
    expect(adviseAso({ coverage })).not.toHaveProperty("violations");
  });

  it("점유 신호가 없으면 순위를 매기지 않는다 — 지어낸 순위는 그럴듯하게 틀린다", () => {
    const r = adviseAso({ coverage });
    expect(r.levers).toEqual([]);
    expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/점유/);
  });

  it("점유 신호를 주면 빠진 로케일을 신호 순으로 낸다", () => {
    const r = adviseAso({ coverage, signals: { share: { "pt-BR": 0.13, "fr-FR": 0.05, "de-DE": 0.09 } } });
    expect(r.levers.map((l: any) => l.locale)).toEqual(["pt-BR", "de-DE", "fr-FR"]);
  });

  it("이미 채운 로케일은 레버가 아니다", () => {
    const r = adviseAso({ coverage, signals: { share: { "en-US": 0.4, "pt-BR": 0.13 } } });
    expect(r.levers.map((l: any) => l.locale)).not.toContain("en-US");
  });

  it("신호가 없는 빠진 로케일은 순위에 끼우지 않고 셈으로 남긴다", () => {
    const r = adviseAso({ coverage, signals: { share: { "pt-BR": 0.13 } } });
    expect(r.levers.map((l: any) => l.locale)).toEqual(["pt-BR"]);
    expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/2/);
  });

  it("번역 품질은 판정하지 않았다고 항상 적는다", () => {
    const r = adviseAso({ coverage, signals: { share: { "pt-BR": 0.13 } } });
    expect(r.unanswerable.map((u: any) => u.question).join(" ")).toMatch(/품질/);
  });

  it("답할 수 없는 질문 자체에 무엇이 없는지 적는다 — needs 에만 적으면 읽는 사람이 모른다", () => {
    const r = adviseAso({ coverage });
    expect(r.unanswerable.length).toBeGreaterThan(0);
    for (const u of r.unanswerable) {
      expect(u.question.length, JSON.stringify(u)).toBeGreaterThan(0);
      expect(u.needs.length, JSON.stringify(u)).toBeGreaterThan(0);
    }
  });

  it("커버리지가 없어도 던지지 않고 답할 수 없다고 낸다", () => {
    const r = adviseAso({});
    expect(r.levers).toEqual([]);
    expect(r.unanswerable.length).toBeGreaterThan(0);
  });
});
