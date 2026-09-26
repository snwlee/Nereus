import { describe, it, expect, afterEach } from "vitest";
import fs, { mkdtempSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { digestJob, writeApproval, checkApproval, consumeApproval, APPROVAL_TTL_MS } from "../../plugins/nereus/skills/phone/scripts/approval.mjs";

const job = { to: "+81977852848", language: "ja", instructions: "[AI-DISCLOSURE] x", timeLimitSec: 600, hours: { start: 17, end: 22 } };
const t0 = new Date("2026-11-01T08:00:00Z");
let dir = "";
afterEach(() => dir && fs.rmSync(dir, { recursive: true, force: true }));

describe("phone.approval", () => {
  it("같은 잡은 같은 지문, 지시문이 바뀌면 다른 지문", () => {
    expect(digestJob(job)).toBe(digestJob({ ...job }));
    expect(digestJob(job)).not.toBe(digestJob({ ...job, instructions: "[AI-DISCLOSURE] y" }));
    expect(digestJob(job)).not.toBe(digestJob({ ...job, to: "+821012345678" }));
    expect(digestJob(job)).toBe(digestJob({ ...job, callSid: "CA1" }));   // 발신 뒤 붙는 callSid 는 지문에 안 들어간다
  });

  it("승인 → 확인 ok → 소비하면 다시 못 쓴다", () => {
    dir = mkdtempSync(join(os.tmpdir(), "phone-appr-"));
    writeApproval(dir, "w", job, t0);
    expect(checkApproval(dir, "w", job, new Date(t0.getTime() + 60_000))).toEqual({ ok: true });
    consumeApproval(dir, "w");
    expect(checkApproval(dir, "w", job, t0)).toEqual({ ok: false, reason: "approval-missing" });
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
  });

  it("승인 뒤 잡이 바뀌면 mismatch, 오래되면 expired", () => {
    dir = mkdtempSync(join(os.tmpdir(), "phone-appr-"));
    writeApproval(dir, "w", job, t0);
    expect(checkApproval(dir, "w", { ...job, instructions: "[AI-DISCLOSURE] z" }, t0).reason).toBe("approval-mismatch");
    expect(checkApproval(dir, "w", job, new Date(t0.getTime() + APPROVAL_TTL_MS + 1)).reason).toBe("approval-expired");
  });

  it("잘못된 id 는 거절", () => {
    dir = mkdtempSync(join(os.tmpdir(), "phone-appr-"));
    expect(() => writeApproval(dir, "../x", job, t0)).toThrow();
  });
});
