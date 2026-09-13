// 프로세스 리그: 단위 테스트가 전부 초록인데 `node <검사기>` 가 0바이트를 내는 상태를
// 코어 doctor 에서 실제로 겪었다(2026-09-13). 진입점은 단위 테스트로 덮이지 않는다.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

// 기본 버퍼는 64KiB 다. 넘치면 ENOBUFS 로 죽는다.
const run = (s: string, input: string) =>
  execFileSync("node", [s], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });

const POLICY = "plugins/nereus-ads/lib/ad-policy-check.mjs";
const FUNNEL = "plugins/nereus-ads/lib/ad-funnel.mjs";

describe("nereus-ads 프로세스 리그", () => {
  it("정책 검사기를 프로세스로 돌린다", () => {
    const out = run(
      POLICY,
      JSON.stringify({
        build: { debug: true },
        units: [{ format: "interstitial", platform: "android", resolvedId: "ca-app-pub-9999/1" }],
      }),
    );
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("prod-unit-in-debug");
  });

  it("퍼널 조언자를 프로세스로 돌린다", () => {
    const out = run(
      FUNNEL,
      JSON.stringify({
        formats: [{ format: "rewarded", requests: 100, matched: 92, impressions: 17, revenue: 5 }],
        targets: { showRate: 0.3, matchRate: 0.8 },
      }),
    );
    expect(JSON.parse(out).bottleneck.rewarded).toBe("show");
  });

  it("입력이 없어도 진입점이 유효한 JSON 을 낸다 — 0바이트가 아니다", () => {
    for (const s of [POLICY, FUNNEL]) {
      const out = run(s, "");
      expect(out.trim().length, s).toBeGreaterThan(0);
      expect(() => JSON.parse(out), s).not.toThrow();
    }
  });

  it("깨진 JSON 은 스택 프레임 없이 사유만 낸다", () => {
    for (const s of [POLICY, FUNNEL]) {
      let failed = false;
      try {
        run(s, "{nope");
      } catch (e: any) {
        failed = true;
        expect(e.status, s).not.toBe(0);
        // V8 의 JSON 오류 메시지에 `at position` 이 들어간다 — 스택 *프레임* 모양으로만 본다.
        expect(String(e.stderr), s).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
        expect(String(e.stderr), s).toMatch(/JSON/);
      }
      expect(failed, `${s} 가 깨진 입력에 종료되지 않았다`).toBe(true);
    }
  });
});
