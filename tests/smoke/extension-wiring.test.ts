// 회귀: "확장점을 만들고 아무 데서도 호출하지 않는" 결함(리뷰 H1)을 막는다.
// 단위 테스트가 초록인 채로 프로덕션에서 죽어 있었기 때문에, 호출부 자체를 검사한다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf8");
const S = "plugins/nereus/hooks/scripts";

describe("확장 배선", () => {
  it("라우팅 호출부가 extraRoutes 를 넘긴다", () => {
    expect(read(`${S}/skill-router.mjs`)).toMatch(/routePrompt\([^)]*extraRoutes/s);
    expect(read(`${S}/session-start.mjs`)).toMatch(/skillMapBlock\(\{\s*extraRoutes/s);
  });

  it("스택 호출부가 extraStacks 를 넘긴다", () => {
    for (const f of [`${S}/tdd-guard.mjs`, `${S}/pre-tool-guard.mjs`, "plugins/nereus/skills/build/scripts/run-tests.mjs"]) {
      expect(read(f), f).toMatch(/detectTestRunner\([^;]*extraStacks/s);
    }
  });

  it("확장을 쓰는 파일은 loadExtensions 를 import 한다", () => {
    for (const f of [
      `${S}/skill-router.mjs`,
      `${S}/session-start.mjs`,
      `${S}/tdd-guard.mjs`,
      `${S}/pre-tool-guard.mjs`,
      "plugins/nereus/skills/build/scripts/run-tests.mjs",
    ]) {
      expect(read(f), f).toContain("loadExtensions");
    }
  });
});

// 회귀(2026-09-12, 실제 로블록스 리그에서 발견): 확장 스택이 러너를 선언해도 코어가
// 그 언어의 확장자를 몰라 tdd-guard/tdd-gate 가 "소스가 아님"으로 빠졌다.
// 게임 스택에서 TDD 강제가 **한 번도 발동할 수 없는** 상태였고, 픽스처 검증만 해서 못 봤다.
describe("확장 스택 파일 규칙 배선", () => {
  it("tdd-guard 가 stackFileRules 를 계산해 소스·테스트 판정에 넘긴다", () => {
    const src = read("plugins/nereus/hooks/scripts/tdd-guard.mjs");
    expect(src).toContain("stackFileRules");
    expect(src).toMatch(/isSourceFile\(rel,\s*fileRules\)/);
    expect(src).toMatch(/isTestFile\(rel,\s*fileRules\)/);
  });

  it("pre-tool-guard 가 차단 판정에 fileRules 를 넘긴다", () => {
    const src = read("plugins/nereus/hooks/scripts/pre-tool-guard.mjs");
    expect(src).toContain("stackFileRules");
    expect(src).toMatch(/fileRules,/);
    expect(src).toMatch(/findTestFor\(rel, files, fileRules\)/);
  });

  it("tdd-gate 가 fileRules 를 실제로 판정에 쓴다 — 받기만 하면 배선이 아니다", () => {
    const src = read("plugins/nereus/hooks/scripts/lib/tdd-gate.mjs");
    expect(src).toMatch(/isSourceFile\(rel,\s*fileRules\)/);
    expect(src).toMatch(/isTestFile\(rel,\s*fileRules\)/);
  });

  it("러너를 선언한 게임 스택은 소스 확장자도 선언한다 — 하나만 있으면 게이트가 무효다", () => {
    const decl = JSON.parse(read("plugins/nereus-game/nereus-extension.json"));
    const withRunner = decl.stacks.filter((s: any) => s.runner);
    expect(withRunner.length).toBeGreaterThan(0);
    for (const st of withRunner) {
      expect(Array.isArray(st.sourceExt) && st.sourceExt.length > 0).toBe(true);
    }
  });

  it("선언된 테스트 정규식은 전부 컴파일된다", () => {
    const decl = JSON.parse(read("plugins/nereus-game/nereus-extension.json"));
    for (const st of decl.stacks) for (const r of st.testRe ?? []) expect(() => new RegExp(r)).not.toThrow();
  });
});

// 회귀: 저장소에서 doctor.mjs 진입점을 고쳤는데(`b4d84cb`) **버전을 안 올려서**
// 설치 캐시(`~/.claude/plugins/cache/<mp>/<plugin>/<version>/`)가 낡은 채로 남았다.
// 설치본의 `node doctor.mjs` 는 그 뒤로도 0바이트를 냈다(2026-09-13 실측).
// 캐시는 **버전 키로 잡히므로** 버전이 그대로면 `plugin update` 가 가져올 것이 없다.
// 설치 상태 자체는 환경 의존이라 테스트할 수 없다. 대신 그 앞단 — 마켓플레이스 등재와
// 매니페스트의 버전이 어긋나지 않는 것 — 을 전 플러그인에 대해 강제한다.
describe("플러그인 버전 정합", () => {
  const mp = JSON.parse(read(".claude-plugin/marketplace.json"));

  it.each(mp.plugins.map((p: any) => p.name))("%s 의 등재 버전과 매니페스트 버전이 같다", (name) => {
    const entry = mp.plugins.find((p: any) => p.name === name);
    // source 는 `./plugins/<dir>` 형태다. 디렉터리 이름을 이름에서 추측하지 않는다.
    const dir = String(entry.source).replace(/^\.\//, "");
    const manifest = JSON.parse(read(`${dir}/.claude-plugin/plugin.json`));
    expect(manifest.name, `${dir} 의 매니페스트 이름이 등재와 다르다`).toBe(name);
    expect(entry.version, `${name}: 등재 ${entry.version} ≠ 매니페스트 ${manifest.version}`).toBe(manifest.version);
  });
});
