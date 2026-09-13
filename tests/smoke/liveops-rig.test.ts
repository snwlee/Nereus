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
  it("폰트 검사기를 프로세스로 돌려 라이선스 위반을 받는다", () => {
    const fonts = [{ name: "WebOnly", embedding: ["web"], scripts: ["latin"], sizeKb: 100, minSizePx: 20 }];
    const out = runNode("plugins/nereus-game/lib/font-check.mjs", JSON.stringify({ genre: "obby-platformer", fonts, targetLocales: ["en"] }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("license-embedding");
  });
  // gemini 리뷰 [HIGH] 후속: 사유 있는 메시지를 만들어도 uncaught 로 던지면 스택트레이스에 묻힌다.
  // CLI 는 사유만 내고 종료해야 한다.
  it("깨진 JSON 은 스택트레이스 없이 사유만 내고 종료한다", () => {
    for (const lib of ["sound-budget", "liveops-plan", "impact-budget", "font-check"]) {
      let stderr = "";
      let status = 0;
      try {
        runNode(`plugins/nereus-game/lib/${lib}.mjs`, "{bad json");
      } catch (e: any) {
        stderr = String(e.stderr ?? "");
        status = e.status;
      }
      expect(status, lib).not.toBe(0);
      expect(stderr, lib).toContain("stdin 으로 받은 JSON");
      expect(stderr, lib).not.toContain("at async");
      expect(stderr, lib).not.toContain("node:internal");
    }
  });
  // gemini 리뷰 [CRITICAL], 측정으로 확정: 진입점의 process.exit(0) 이 파이프 stdout 을
  // 정확히 64KiB(파이프 버퍼)에서 잘랐다. 조용한 데이터 손실이다 —
  // 쓰기가 비동기로 끝나기 전에 프로세스가 죽는다. exit(0) 은 애초에 불필요하다.
  it("큰 출력이 파이프에서 잘리지 않는다", () => {
    const cues = Array.from({ length: 4000 }, (_, i) => ({ name: `c${i}`, visual: true }));
    const input = JSON.stringify({ genre: "battle-pvp", plan: { maxParticles: 1, inputBufferMs: 999, cues }, soundCues: [] });
    const out = runNode("plugins/nereus-game/lib/impact-budget.mjs", input);
    expect(out.length).toBeGreaterThan(65536);
    const parsed = JSON.parse(out);
    expect(parsed.violations.length).toBe(8000);
  });
});
