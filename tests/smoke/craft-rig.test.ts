// 회귀: 픽스처 초록은 검증이 아니다. 새 확장점은 프로세스 수준 리그를 같이 넣는다.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const runNode = (script: string, input: string) =>
  execFileSync("node", [script], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });

const PURITY = "plugins/nereus-game/lib/purity-check.mjs";
const PARITY = "plugins/nereus-game/lib/parity-check.mjs";

describe("제작 층 검사기 실행 진입점", () => {
  it("purity 를 프로세스로 돌려 계층 위반을 stdout 으로 받는다", () => {
    const out = runNode(PURITY, JSON.stringify({
      engine: "flutter",
      sources: [{ file: "lib/core/scoring.dart", text: "import 'package:flutter/material.dart';\n" }],
    }));
    const r = JSON.parse(out);
    expect(r.violations.map((v: any) => v.code)).toContain("layer-import");
    expect(String(r.violations[0].why).length).toBeGreaterThan(20);
  });

  it("parity 를 프로세스로 돌려 플레이버 분기를 stdout 으로 받는다", () => {
    const out = runNode(PARITY, JSON.stringify({
      flavors: ["a", "b"],
      sources: [{ file: "lib/a.dart", text: '  if (flavor == "a") { x(); }\n' }],
    }));
    const r = JSON.parse(out);
    expect(r.applicable).toBe(true);
    expect(r.violations.map((v: any) => v.code)).toContain("flavor-branch");
  });

  it("플레이버가 없으면 해당 없음을 프로세스로도 그대로 낸다", () => {
    const r = JSON.parse(runNode(PARITY, JSON.stringify({ flavors: [], sources: [] })));
    expect(r.applicable).toBe(false);
    expect(String(r.why).length).toBeGreaterThan(20);
  });

  it("알 수 없는 엔진은 0 이 아닌 코드로 끝난다", () => {
    expect(() => runNode(PURITY, JSON.stringify({ engine: "nope", sources: [] }))).toThrow();
  });

  it("깨진 JSON 은 스택트레이스 없이 사유만 내고 종료한다", () => {
    for (const script of [PURITY, PARITY]) {
      try {
        runNode(script, "{not json");
        throw new Error(`${script} 가 종료되지 않았다`);
      } catch (e: any) {
        expect(e.status, script).not.toBe(0);
        // "at " 만 보면 안 된다 — V8 의 JSON 오류 문구 자체에 "at position N" 이 들어 있다.
        // 스택 프레임은 파일 경로가 따라온다: `    at file:///... .mjs:12:3`
        expect(String(e.stderr), script).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
        expect(String(e.stderr), script).toContain("JSON");
      }
    }
  });

  // process.exit(0) 을 부르면 파이프 stdout 이 64KiB 에서 잘린다. 측정으로 확인된 결함이다.
  it("64KiB 를 넘는 출력이 잘리지 않는다", () => {
    const sources = Array.from({ length: 4000 }, (_, i) => ({
      file: `lib/core/f${i}.dart`,
      text: "import 'package:flutter/material.dart';\n",
    }));
    const out = runNode(PURITY, JSON.stringify({ engine: "flutter", sources }));
    expect(out.length).toBeGreaterThan(65536);
    expect(JSON.parse(out).violations).toHaveLength(4000);
  });
});
