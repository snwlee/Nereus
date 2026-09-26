import { describe, it, expect } from "vitest";
import { judge, countryOf, MIN_BALANCE_USD, MAX_CALL_SEC, DEFAULT_HOURS } from "../../plugins/nereus/skills/phone/scripts/judge.mjs";

// 실측 기준 probe: 2026-09-26 이 맥 — 계정 Full, 잔액 $20, Trust Hub draft, 중계 health 200, Geo JP low-risk on.
const probeOk = (over = {}) => ({ envMissing: [], kyc: "twilio-approved", balanceUsd: 20, relayLocal: true, relayPublic: true, geo: ["JP", "KR"], ...over });
const job = { instructions: "[AI-DISCLOSURE] こちらはAIアシスタントです", language: "ja", timeLimitSec: 600 };
const req = (over = {}) => ({ risk: "call", to: "+81977852848", job, localHour: 14, approved: true, ...over });

describe("phone.readiness", () => {
  it("KYC 미승인은 block", () => {
    const r = judge(probeOk({ kyc: "draft" }), req());
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("kyc-not-approved");
  });

  it("여러 문제는 모두 싣는다", () => {
    const r = judge(probeOk({ balanceUsd: 0.5, relayLocal: false }), req());
    expect(r.verdict).toBe("block");
    expect(r.reasons).toEqual(expect.arrayContaining(["balance-low", "relay-local-down"]));
  });

  it("env 누락·공개 중계 down", () => {
    const r = judge(probeOk({ envMissing: ["TWILIO_FROM"], relayPublic: false }), req());
    expect(r.reasons).toEqual(expect.arrayContaining(["env-missing", "relay-public-down"]));
  });

  it("조회는 막지 않는다", () => {
    const r = judge(probeOk({ kyc: "draft" }), { risk: "read" });
    expect(r.verdict).toBe("go");
    expect(r.reasons).toContain("kyc-not-approved");
  });
});

describe("phone.request", () => {
  it("승인 없는 발신은 ask", () => {
    const r = judge(probeOk(), req({ approved: false }));
    expect(r.verdict).toBe("ask");
    expect(r.reasons).toEqual(["needs-approval"]);
  });

  it("승인 있는 발신은 go", () => {
    expect(judge(probeOk(), req())).toEqual({ verdict: "go", reasons: [] });
  });

  it("일본 밤 11시는 block", () => {
    const r = judge(probeOk(), req({ localHour: 23 }));
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("outside-call-hours");
  });

  it("잡의 영업시간을 쓴다", () => {
    const r = judge(probeOk(), req({ localHour: 17, job: { ...job, hours: { start: 17, end: 22 } } }));
    expect(r.verdict).toBe("go");
    expect(judge(probeOk(), req({ localHour: 16, job: { ...job, hours: { start: 17, end: 22 } } })).reasons).toContain("outside-call-hours");
  });

  it("카드번호가 섞인 잡", () => {
    const r = judge(probeOk(), req({ job: { ...job, instructions: `${job.instructions} card 4111 1111 1111 1111` } }));
    expect(r.verdict).toBe("block");
    expect(r.reasons).toContain("secret-in-job");
  });

  it("AI 고지 없는 잡", () => {
    expect(judge(probeOk(), req({ job: { ...job, instructions: "こんにちは" } })).reasons).toContain("disclosure-missing");
  });

  it("통화 상한 초과", () => {
    expect(judge(probeOk(), req({ job: { ...job, timeLimitSec: MAX_CALL_SEC + 1 } })).reasons).toContain("time-limit-too-long");
  });

  it("번호 형식·국가·Geo", () => {
    expect(judge(probeOk(), req({ to: "0977852848" })).reasons).toContain("bad-number");
    expect(judge(probeOk(), req({ to: "+999123456789" })).reasons).toContain("country-unknown");
    expect(judge(probeOk(), req({ to: "+14155550100" })).reasons).toContain("geo-blocked");
  });

  it("알 수 없는 risk 는 block", () => {
    expect(judge(probeOk(), { risk: "sms" }).reasons).toContain("unknown-risk");
  });
});

describe("countryOf", () => {
  it("긴 접두어가 이긴다", () => {
    expect(countryOf("+85221234567")).toEqual({ iso: "HK", tz: "Asia/Hong_Kong" });
    expect(countryOf("+81977852848")).toEqual({ iso: "JP", tz: "Asia/Tokyo" });
    expect(countryOf("+999123")).toBeNull();
  });

  it("상수", () => {
    expect(MIN_BALANCE_USD).toBeGreaterThan(0);
    expect(DEFAULT_HOURS).toEqual({ start: 9, end: 20 });
  });
});
