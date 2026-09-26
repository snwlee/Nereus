import { describe, it, expect } from "vitest";
import { buildJob, DISCLOSURE_TAG } from "../../plugins/nereus/skills/phone/scripts/brief.mjs";
import { judge, DEFAULT_HOURS } from "../../plugins/nereus/skills/phone/scripts/judge.mjs";

// 첫 사용처: 유후인 와사쿠 — 11/4 영업 여부 + 19:00 성인 4명.
const brief = {
  to: "+81977852848", language: "ja", target: "七厘焼き和作", onBehalfOf: "イ・ソヌ",
  facts: ["2026年11月4日(水) 大人4名"], questions: ["11月4日は営業されますか", "19時に4名で予約できますか"],
};

describe("phone.brief", () => {
  it("일본어 식당 문의 지시문", () => {
    const j = buildJob(brief);
    expect(j.instructions).toContain("こちらはAIアシスタント");
    expect(j.instructions).toContain("イ・ソヌ");
    expect(j.instructions).toContain(DISCLOSURE_TAG);
    expect(j.instructions).toContain("end_call");
    for (const q of brief.questions) expect(j.instructions).toContain(q);
    for (const f of brief.facts) expect(j.instructions).toContain(f);
    expect(j).toMatchObject({ to: brief.to, language: "ja", timeLimitSec: 600, hours: DEFAULT_HOURS });
  });

  it("기본은 확정 금지, mayCommit 항목만 허용 문장이 붙는다", () => {
    expect(buildJob(brief).instructions).toMatch(/Do not make, change or cancel/);
    const j = buildJob({ ...brief, mayCommit: ["Make the 19:00 reservation for 4 adults if available"] });
    expect(j.instructions).toContain("Make the 19:00 reservation for 4 adults if available");
  });

  it("한국어·영어 첫 문장", () => {
    expect(buildJob({ ...brief, language: "ko" }).instructions).toContain("AI 어시스턴트");
    expect(buildJob({ ...brief, language: "en" }).instructions).toContain("AI assistant");
  });

  it("브리프의 hours·timeLimitSec 을 쓴다", () => {
    const j = buildJob({ ...brief, hours: { start: 17, end: 22 }, timeLimitSec: 300 });
    expect(j.hours).toEqual({ start: 17, end: 22 });
    expect(j.timeLimitSec).toBe(300);
  });

  it("질문이 없으면 에러", () => {
    expect(() => buildJob({ ...brief, questions: [] })).toThrow();
  });

  it("필수 칸·언어 검사", () => {
    expect(() => buildJob({ ...brief, language: "zh" })).toThrow();
    expect(() => buildJob({ ...brief, to: "" })).toThrow();
    expect(() => buildJob({ ...brief, target: "" })).toThrow();
    expect(() => buildJob({ ...brief, onBehalfOf: "" })).toThrow();
  });

  it("judge 가 buildJob 결과를 disclosure-missing 없이 통과시킨다", () => {
    const probe = { envMissing: [], kyc: "twilio-approved", balanceUsd: 20, relayLocal: true, relayPublic: true, geo: ["JP"] };
    const r = judge(probe, { risk: "call", to: brief.to, job: buildJob(brief), localHour: 14, approved: true });
    expect(r).toEqual({ verdict: "go", reasons: [] });
  });
});
