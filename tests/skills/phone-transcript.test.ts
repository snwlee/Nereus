import { describe, it, expect } from "vitest";
import { parseLog, formatTurns } from "../../plugins/nereus/skills/phone/scripts/transcript.mjs";

const line = (who: string, text: string, t = "2026-11-01T01:00:00.000Z") => JSON.stringify({ t, who, text });

describe("phone.transcript", () => {
  it("AI 가 끊은 통화", () => {
    const r = parseLog([line("system", "start job=x"), line("상대", "はい"), line("AI", "失礼します"), line("system", "end_call"), line("system", "stop")].join("\n"));
    expect(r.endedBy).toBe("ai");
    expect(r.ended).toBe(true);
    expect(r.turns.map((t) => t.who)).toEqual(["상대", "AI"]);
    expect(r.job).toBe("x");
  });

  it("상대가 끊은 통화", () => {
    const r = parseLog([line("system", "start job=y"), line("AI", "もしもし"), line("system", "stop")].join("\n"));
    expect(r).toMatchObject({ ended: true, endedBy: "remote" });
  });

  it("끝나지 않은 통화와 오류 줄, 빈 줄", () => {
    const r = parseLog([line("system", "start job=z"), "", line("system", 'openai error {"code":"x"}'), line("system", "hangup 실패 401")].join("\n"));
    expect(r.ended).toBe(false);
    expect(r.endedBy).toBeNull();
    expect(r.errors).toHaveLength(2);
  });

  it("사람이 읽을 줄로 바꾼다", () => {
    const r = parseLog(line("상대", "はい", "2026-11-01T01:02:03.000Z"));
    expect(formatTurns(r.turns)).toBe("01:02:03 상대: はい");
  });
});
