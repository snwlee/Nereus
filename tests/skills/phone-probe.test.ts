import { describe, it, expect } from "vitest";
import { readinessFrom, localHourIn, parseArgs, requestFor } from "../../plugins/nereus/skills/phone/scripts/probe.mjs";
import { loadEnv, readEnv, missingKeys, paths, envFiles, REQUIRED_KEYS } from "../../plugins/nereus/skills/phone/scripts/config.mjs";

// 응답 모양은 2026-09-26 이 계정 실측(Trust Hub CustomerProfiles · Balance · DialingPermissions/Countries).
describe("probe.readinessFrom", () => {
  it("Trust Hub draft 는 kyc draft", () => {
    const r = readinessFrom({ profiles: { results: [{ status: "draft" }] }, balance: { balance: "20.0" }, geo: { content: [{ iso_code: "JP", low_risk_numbers_enabled: true }] } });
    expect(r).toEqual({ kyc: "draft", balanceUsd: 20, geo: ["JP"] });
  });

  it("승인된 프로필이 하나라도 있으면 twilio-approved", () => {
    const r = readinessFrom({ profiles: { results: [{ status: "draft" }, { status: "twilio-approved" }] }, balance: { balance: "3.5" }, geo: { content: [] } });
    expect(r).toEqual({ kyc: "twilio-approved", balanceUsd: 3.5, geo: [] });
  });

  it("응답이 없으면 unknown·0·빈 목록", () => {
    expect(readinessFrom({})).toEqual({ kyc: "unknown", balanceUsd: 0, geo: [] });
  });

  it("low-risk 꺼진 나라는 빠진다", () => {
    expect(readinessFrom({ geo: { content: [{ iso_code: "US", low_risk_numbers_enabled: false }] } }).geo).toEqual([]);
  });
});

describe("probe.localHourIn / parseArgs", () => {
  it("UTC 05:30 은 도쿄 14시", () => {
    expect(localHourIn("Asia/Tokyo", new Date("2026-11-01T05:30:00Z"))).toBe(14);
  });

  it("플래그", () => {
    expect(parseArgs(["--risk", "call", "--job", "wasaku-1104", "--approved"])).toEqual({ risk: "call", job: "wasaku-1104", approved: true });
    expect(parseArgs([])).toEqual({ risk: "read", job: null, approved: false });
  });
});

describe("config", () => {
  it("첫 파일이 없으면 두 번째 파일에서 읽는다", () => {
    const env = loadEnv({ required: ["A"], files: ["/nonexistent/env", "tests/fixtures/phone/env"] });
    expect(env.A).toBe("1");
    expect(env.B).toBe("two words");
  });

  it("필수 키가 없으면 이름만 담아 던진다", () => {
    expect(() => loadEnv({ required: ["A", "ZZ"], files: ["tests/fixtures/phone/env"] })).toThrow(/ZZ/);
  });

  it("missingKeys·readEnv", () => {
    const { env, file } = readEnv(["tests/fixtures/phone/env"]);
    expect(file).toBe("tests/fixtures/phone/env");
    expect(missingKeys(env, ["A", "C"])).toEqual(["C"]);
    expect(readEnv(["/nonexistent"]).file).toBeNull();
  });

  it("paths 는 NEREUS_PHONE_HOME 을 따른다", () => {
    const p = paths({ NEREUS_PHONE_HOME: "/tmp/np" });
    expect(p.jobs).toBe("/tmp/np/jobs");
    expect(p.logs).toBe("/tmp/np/logs");
    expect(REQUIRED_KEYS).toContain("TWILIO_FROM");
  });
});

describe("probe.requestFor / config.envFiles", () => {
  it("call 이면 잡 번호의 현지 시각을 싣는다", () => {
    const job = { to: "+81977852848", instructions: "x", timeLimitSec: 60 };
    expect(requestFor({ risk: "call", approved: true }, job, new Date("2026-11-01T05:30:00Z"))).toEqual({ risk: "call", to: job.to, job, localHour: 14, approved: true });
    expect(requestFor({ risk: "read" }, null)).toEqual({ risk: "read" });
  });

  it("nereus 위치가 japancall 보다 먼저다", () => {
    expect(envFiles("/h")).toEqual(["/h/.config/nereus/phone/env", "/h/.config/japancall/env"]);
  });
});
