import { describe, it, expect, afterEach } from "vitest";
import fs, { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { buildTwiml, saveJob, bindCall, parseCallArgs, decide } from "../../plugins/nereus/skills/phone/scripts/call.mjs";

const probeOk = { envMissing: [], kyc: "twilio-approved", balanceUsd: 20, relayLocal: true, relayPublic: true, geo: ["JP"] };
const brief = { to: "+81977852848", language: "ja", target: "七厘焼き和作", onBehalfOf: "イ・ソヌ", facts: ["大人4名"], questions: ["11月4日は営業されますか"] };
const tokyo14 = new Date("2026-11-01T05:00:00Z");

let dir = "";
afterEach(() => dir && fs.rmSync(dir, { recursive: true, force: true }));

describe("phone.call", () => {
  it("TwiML 은 스트림 주소와 잡 id 를 담고 XML 특수문자를 막는다", () => {
    const x = buildTwiml({ wss: "wss://h/japancall/s/stream", jobId: "wasaku-1104" });
    expect(x).toContain('<Stream url="wss://h/japancall/s/stream">');
    expect(x).toContain('<Parameter name="job" value="wasaku-1104"/>');
    expect(() => buildTwiml({ wss: "wss://h/x", jobId: 'a"b' })).toThrow();
    expect(() => buildTwiml({ wss: 'wss://h/"x', jobId: "a" })).toThrow();
  });

  it("saveJob 은 잡 파일을 쓰고 잘못된 id 를 막는다", () => {
    dir = mkdtempSync(join(os.tmpdir(), "phone-call-"));
    saveJob(dir, "wasaku-1104", { to: "+81" });
    expect(JSON.parse(readFileSync(join(dir, "wasaku-1104.json"), "utf8"))).toEqual({ to: "+81" });
    expect(() => saveJob(dir, "../x", {})).toThrow();
  });

  it("플래그", () => {
    expect(parseCallArgs(["--brief", "b.json", "--id", "w", "--to", "+8210", "--approved"])).toEqual({ brief: "b.json", id: "w", to: "+8210", approved: true });
    expect(parseCallArgs(["--brief", "b.json", "--id", "w"]).approved).toBe(false);
  });

  it("승인 없으면 ask, 있으면 go", () => {
    expect(decide({ probe: probeOk, brief, approved: false, now: tokyo14 }).verdict).toBe("ask");
    const d = decide({ probe: probeOk, brief, approved: true, now: tokyo14 });
    expect(d.verdict).toBe("go");
    expect(d.job.instructions).toContain("[AI-DISCLOSURE]");
  });

  it("--to 로 리허설 번호를 주면 그 번호로 판정한다", () => {
    const d = decide({ probe: { ...probeOk, geo: ["KR"] }, brief, to: "+821012345678", approved: true, now: new Date("2026-11-01T05:00:00Z") });
    expect(d.job.to).toBe("+821012345678");
    expect(d.verdict).toBe("go");
  });

  it("KYC 미승인은 block", () => {
    expect(decide({ probe: { ...probeOk, kyc: "draft" }, brief, approved: true, now: tokyo14 }).reasons).toContain("kyc-not-approved");
  });
});

describe("phone.call binding (보안 리뷰 M3·M4)", () => {
  it("발신한 잡은 덮어쓰지 못하고 callSid 가 기록된다", () => {
    dir = mkdtempSync(join(os.tmpdir(), "phone-call-"));
    saveJob(dir, "w", { to: "+81" });
    saveJob(dir, "w", { to: "+82" });   // 발신 전에는 다시 쓸 수 있다
    fs.writeFileSync(join(dir, "w.json"), JSON.stringify({ to: "+99-tampered" }));   // 발신 중에 누가 파일을 바꿔도
    bindCall(dir, "w", { to: "+82" }, "CA123");                                        // 판정한 잡(메모리)에 callSid 를 붙인다
    expect(JSON.parse(readFileSync(join(dir, "w.json"), "utf8"))).toEqual({ to: "+82", callSid: "CA123" });
    expect(() => saveJob(dir, "w", { to: "+83" })).toThrow(/이미 발신/);
    expect(() => bindCall(dir, "w", { to: "+82" }, "../x")).toThrow();
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
  });
});
