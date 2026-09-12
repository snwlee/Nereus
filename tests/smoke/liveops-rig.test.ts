// 회귀: 픽스처 초록은 검증이 아니다. 4사이클을 그렇게 보내고 리그를 만들자마자
// 치명적 결함이 나왔다. 새 확장점은 프로세스 수준 리그를 같이 넣는다.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let home = "";
beforeAll(() => { home = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-liveops-")); });
afterAll(() => { fs.rmSync(home, { recursive: true, force: true }); });

const runNode = (script: string, input: string) =>
  execFileSync("node", [script], { input, encoding: "utf8", env: { ...process.env, HOME: home }, stdio: ["pipe", "pipe", "pipe"] });

describe("도메인 검사기 실행 진입점", () => {
  it("liveops 검사기를 프로세스로 돌려 위반을 stdout 으로 받는다", () => {
    const plan = { events: [{ name: "a", start: 1, end: 5 }], economy: { sources: [], sinks: [] }, retention: { d1: 0.4, d7: 0.2, d30: 0.1 } };
    const out = runNode("plugins/nereus-game/lib/liveops-plan.mjs", JSON.stringify({ genre: "sim-tycoon", plan }));
    const r = JSON.parse(out);
    expect(r.violations.map((v: any) => v.code)).toContain("no-rollback");
    expect(r.unmeasured).toContain("retention-actual");
  });
  it("sound 검사기를 프로세스로 돌려 위반을 stdout 으로 받는다", () => {
    const plan = { maxConcurrent: 999, loudnessLufs: -14, cues: [], actions: [] };
    const out = runNode("plugins/nereus-game/lib/sound-budget.mjs", JSON.stringify({ genre: "obby-platformer", plan }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("concurrency");
  });
  it("알 수 없는 장르는 프로세스가 0 이 아닌 코드로 끝난다", () => {
    expect(() => runNode("plugins/nereus-game/lib/sound-budget.mjs", JSON.stringify({ genre: "nope", plan: {} }))).toThrow();
  });
  it("impact 검사기를 프로세스로 돌려 사운드 교차 검증 결과를 받는다", () => {
    const plan = { maxParticles: 10, inputBufferMs: 999, cues: [{ name: "hit", visual: true, sound: "nope", haptic: true }] };
    const out = runNode("plugins/nereus-game/lib/impact-budget.mjs", JSON.stringify({ genre: "battle-pvp", plan, soundCues: ["swing"] }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("sound-missing");
  });
});
