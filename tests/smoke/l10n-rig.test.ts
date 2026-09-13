// 프로세스 리그: 단위 테스트가 전부 초록인데 `node <검사기>` 가 0바이트를 내는 상태를
// 코어 doctor 에서 실제로 겪었다(2026-09-13). 진입점은 단위 테스트로 덮이지 않는다.
//
// 이 파일의 폰트 검사기 케이스 2건은 `tests/smoke/liveops-rig.test.ts` 에서 **옮겨온 것**이다.
// font-check.mjs 가 nereus-game 에서 nereus-l10n 으로 이관됐다. 지운 것이 아니다.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

// 기본 버퍼는 64KiB 다. 넘치면 ENOBUFS 로 죽는다.
const runNode = (script: string, input: string) =>
  execFileSync("node", [script], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });

const FONT = "plugins/nereus-l10n/lib/font-check.mjs";
const STORE = "plugins/nereus-l10n/lib/store-l10n-check.mjs";
const ASO = "plugins/nereus-l10n/lib/aso-advisor.mjs";

describe("nereus-l10n 프로세스 리그", () => {
  it("폰트 검사기를 프로세스로 돌려 라이선스 위반을 받는다", () => {
    const fonts = [{ name: "WebOnly", embedding: ["web"], scripts: ["latin"], sizeKb: 100, minSizePx: 20 }];
    const out = runNode(FONT, JSON.stringify({ requiredEmbedding: "game", fonts, targetLocales: ["en"] }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("license-embedding");
  });

  // 장르를 받지 않는다 — 장르 프로파일은 게임 고유라 이 플러그인이 전제하지 않는다.
  it("장르 없이도 돌고, 예산 기준은 typography 로 받는다", () => {
    const fonts = [{ name: "Big", embedding: ["game"], scripts: ["latin"], sizeKb: 999, minSizePx: 20 }];
    const out = runNode(FONT, JSON.stringify({ requiredEmbedding: "game", typography: { maxFontKb: 10, minSizePx: 18 }, fonts, targetLocales: ["en"] }));
    const r = JSON.parse(out);
    expect(r.violations.map((v: any) => v.code)).toContain("font-size-budget");
    expect(r.unmeasured).toEqual([]);
  });

  it("요구 임베딩을 안 주면 미선언으로 낸다 — 모름은 허용이 아니다", () => {
    const fonts = [{ name: "Any", embedding: ["game"], scripts: ["latin"], sizeKb: 10, minSizePx: 20 }];
    const out = runNode(FONT, JSON.stringify({ fonts, targetLocales: ["en"] }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("required-embedding-undeclared");
  });

  it("입력이 없어도 유효한 JSON 을 낸다 — 0바이트가 아니다", () => {
    const out = runNode(FONT, "");
    expect(out.trim().length).toBeGreaterThan(0);
    expect(() => JSON.parse(out)).not.toThrow();
  });

  // 사유 있는 메시지를 만들어도 uncaught 로 던지면 스택트레이스에 묻힌다.
  it("깨진 JSON 은 스택트레이스 없이 사유만 내고 종료한다", () => {
    let stderr = "";
    let status = 0;
    try {
      runNode(FONT, "{bad json");
    } catch (e: any) {
      stderr = String(e.stderr ?? "");
      status = e.status;
    }
    expect(status).not.toBe(0);
    expect(stderr).toContain("stdin 으로 받은 JSON");
    // V8 의 JSON 오류 메시지에 `at position` 이 들어간다 — 스택 *프레임* 모양으로만 본다.
    expect(stderr).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
  });

  it("스토어 게이트를 프로세스로 돌린다", () => {
    const out = runNode(STORE, JSON.stringify({ store: "play", declaredLocales: ["ko"], listings: { ko: { title: "A" } } }));
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("locale-code-unknown");
  });

  it("스토어 게이트가 미달을 위반이 아니라 coverage 로 낸다", () => {
    const out = runNode(STORE, JSON.stringify({
      store: "play", declaredLocales: ["en-US"], listings: { "en-US": { title: "A" } },
      doNotTranslate: [{ field: "title", why: "검색 키워드" }],
    }));
    const r = JSON.parse(out);
    expect(r.violations).toEqual([]);
    expect(r.coverage.required).toBe(86);
    expect(r.coverage.missing.length).toBe(85);
  });

  it("조언자를 프로세스로 돌린다", () => {
    const out = runNode(ASO, JSON.stringify({
      coverage: { required: 86, present: 1, missing: ["pt-BR"] }, signals: { share: { "pt-BR": 0.13 } },
    }));
    const r = JSON.parse(out);
    expect(r.levers[0].locale).toBe("pt-BR");
    expect(r).not.toHaveProperty("violations");
  });

  it("세 검사기 전부 입력이 없어도 유효한 JSON 을 낸다 — 0바이트가 아니다", () => {
    for (const s of [FONT, STORE, ASO]) {
      const out = runNode(s, "");
      expect(out.trim().length, s).toBeGreaterThan(0);
      expect(() => JSON.parse(out), s).not.toThrow();
    }
  });

  it("세 검사기 전부 깨진 JSON 에 스택 프레임 없이 사유만 낸다", () => {
    for (const s of [FONT, STORE, ASO]) {
      let failed = false;
      try { runNode(s, "{bad json"); } catch (e: any) {
        failed = true;
        expect(e.status, s).not.toBe(0);
        expect(String(e.stderr), s).toContain("stdin 으로 받은 JSON");
        expect(String(e.stderr), s).not.toMatch(/^\s+at .*:\d+:\d+\)?$/m);
      }
      expect(failed, s).toBe(true);
    }
  });
});
