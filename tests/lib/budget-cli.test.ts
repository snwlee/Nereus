import { describe, it, expect } from "vitest";
import { runBudget } from "../../plugins/nereus/skills/montage/scripts/budget.mjs";

const mem = () => { let f: any = null; return { read: () => f, write: (j: any) => { f = j; }, peek: () => f }; };
const NOW = Date.parse("2026-09-24T10:00:00Z");

describe("budget CLI", () => {
  it("init 은 예산과 시작 잔액을 기록한다 (잔액은 사이트에서 자동으로 읽는다)", async () => {
    const s = mem();
    const out = await runBudget(["init", "--limit", "10"], { store: s, now: () => NOW, aside: async () => 'heading "Billing" text: "Balance $12.22"' });
    expect(s.peek().limitUsd).toBe(10);
    expect(s.peek().startBalance).toBeCloseTo(12.22);
    expect(s.peek().readings[0].source).toBe("auto");
    expect(out.code).toBe(0);
  });
  it("자동 조회가 실패하면 수동 입력을 요구하는 코드로 끝난다", async () => {
    const s = mem();
    s.write({ limitUsd: 10, startBalance: 12, readings: [], plan: null });
    const out = await runBudget(["balance"], { store: s, now: () => NOW, aside: async () => 'heading "Welcome to Higgsfield API" Log in' });
    expect(out.code).toBe(3);
    expect(out.text).toContain("--set");
  });
  it("aside 가 없거나 죽어도 수동 입력으로 넘어간다", async () => {
    const s = mem();
    s.write({ limitUsd: 10, startBalance: 12, readings: [], plan: null });
    const out = await runBudget(["balance"], { store: s, now: () => NOW, aside: async () => { throw new Error("aside: command not found"); } });
    expect(out.code).toBe(3);
  });
  it("balance --set 은 사용자가 알려준 값을 수동 출처로 기록한다", async () => {
    const s = mem();
    s.write({ limitUsd: 10, startBalance: 12, readings: [], plan: null });
    await runBudget(["balance", "--set", "9.5"], { store: s, now: () => NOW, aside: async () => "" });
    expect(s.peek().readings.at(-1)).toMatchObject({ usd: 9.5, source: "manual" });
  });
  it("plan 은 계획 비용을 기록하고, status 는 사용액·남은 예산을 보여준다", async () => {
    const s = mem();
    s.write({ limitUsd: 10, startBalance: 12, readings: [{ usd: 9.5, at: new Date(NOW).toISOString(), source: "manual" }], plan: null });
    await runBudget(["plan", "--usd", "3.4", "--note", "Kling 8컷"], { store: s, now: () => NOW, aside: async () => "" });
    expect(s.peek().plan).toMatchObject({ usd: 3.4, note: "Kling 8컷" });
    const st = await runBudget(["status"], { store: s, now: () => NOW, aside: async () => "" });
    expect(st.text).toContain("2.50");
    expect(st.text).toContain("7.50");
  });
  it("prices 는 사이트 가격표를 모델별로 뽑는다", async () => {
    const out = await runBudget(["prices"], { store: mem(), now: () => NOW, aside: async () => 'link "Kling 3.0, 10 modes" text: "up to 1080p from $0.084/s 50% OFF from $0.042/s"' });
    expect(out.text).toContain("Kling 3.0");
    expect(out.text).toContain("0.084");
  });
});
