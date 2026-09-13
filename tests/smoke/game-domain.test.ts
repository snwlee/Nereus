// 이식보다 먼저 깐 검사. 1차에서 "선언했는데 실재하지 않음" 결함을 세 번 놓쳤고
// 세 번 다 단위 테스트는 초록이었다. 이식 분량이 커질수록 재발 확률이 올라간다.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = "plugins/nereus-game";
const DOMAIN_SKILLS = ["level", "narrative", "gameux", "asset", "balance", "craft"];
const ENGINE_TOKENS = [/game\.Players/, /:GetService/, /MonoBehaviour/, /UnityEngine/];

describe("선언한 자산은 실재한다", () => {
  it("라우트가 가리키는 스킬이 전부 있다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    for (const r of ext.routes) {
      const name = r.skill.split(":")[1];
      expect(fs.existsSync(`${ROOT}/skills/${name}/SKILL.md`), r.skill).toBe(true);
    }
  });

  it("도메인 스킬 5종이 존재한다", () => {
    for (const s of DOMAIN_SKILLS) {
      expect(fs.existsSync(`${ROOT}/skills/${s}/SKILL.md`), s).toBe(true);
    }
  });

  it("프로파일이 최소 2종 있고 필수 키를 갖는다", () => {
    const dir = `${ROOT}/profiles`;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const key of ["genre", "loop", "metrics", "balance"]) {
        expect(p[key], `${f}:${key}`).toBeDefined();
      }
    }
  });
});

describe("도메인 스킬은 엔진을 모른다", () => {
  it("엔진 고유 토큰이 없다", () => {
    for (const s of DOMAIN_SKILLS) {
      const text = fs.readFileSync(`${ROOT}/skills/${s}/SKILL.md`, "utf8");
      for (const re of ENGINE_TOKENS) {
        expect(re.test(text), `${s} 에 ${re}`).toBe(false);
      }
    }
  });
});

describe("엔진 스킬은 자기 어댑터를 참조한다", () => {
  it("unity 스킬이 있고 어댑터를 가리킨다", () => {
    expect(fs.existsSync(`${ROOT}/skills/unity/SKILL.md`)).toBe(true);
    const text = fs.readFileSync(`${ROOT}/skills/unity/SKILL.md`, "utf8");
    expect(text).toContain("unity-stack.mjs");
    expect(text).toContain("detectUnityRunner");
  });

  it("unity 스킬이 공식 플러그인 위임 경계를 적는다", () => {
    const text = fs.readFileSync(`${ROOT}/skills/unity/SKILL.md`, "utf8");
    // 판정 없이 "쓰면 좋다"고만 적으면 아무 일도 일어나지 않는다.
    expect(text).toContain("detectUnityAgentPlugin");
    expect(text).toContain("unity@unity-agent-plugin");
    // 넘기는 것과 넘기지 않는 것이 **둘 다** 있어야 경계다.
    expect(text).toMatch(/위임하지 않는[^\n]*/);
    for (const keep of ["TDD 게이트", "design", "compliance", "finish"]) {
      expect(text, keep).toContain(keep);
    }
  });
});

describe("4차 배선", () => {
  it("장르 프로파일이 4종이고 실패 양상이 셋 이상이다", () => {
    const dir = `${ROOT}/profiles`;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(4);
    const modes = new Set(
      files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).balance.failureMode),
    );
    expect(modes.size).toBeGreaterThanOrEqual(3);
  });

  it("README 가 2단 게이트와 doctor 를 안내한다", () => {
    const text = fs.readFileSync(`${ROOT}/README.md`, "utf8");
    expect(text).toContain("robloxStageTwo");
    expect(text).toContain("assetDoctor");
  });
});

// 제작 층. 에이전트 5종이 전부 디자인 산출물을 내고 게임플레이 코드를 짜는 주체가 없었다.
// 스택 스킬들이 "로직을 엔진에서 떼어내는 설계가 곧 1단 커버리지"라고 적어놓고
// 어떻게 떼는지를 비워두었다 — 선언만 하고 검사를 안 붙이면 다음 사이클에 바로 샌다.
describe("제작 층", () => {
  it("craft 스킬이 있다", () => {
    expect(fs.existsSync(`${ROOT}/skills/craft/SKILL.md`)).toBe(true);
  });

  it("gameplay-engineer 에이전트가 있다", () => {
    expect(fs.existsSync(`${ROOT}/agents/gameplay-engineer.md`)).toBe(true);
  });

  it("craft 스킬이 두 검사기를 가리킨다 — 만들고 부르는 곳이 없으면 게이트가 아니다", () => {
    const text = fs.readFileSync(`${ROOT}/skills/craft/SKILL.md`, "utf8");
    expect(text).toContain("purity-check.mjs");
    expect(text).toContain("parity-check.mjs");
  });

  it("계층 경계가 데이터로 있고 엔진 3종을 덮는다", () => {
    const data = JSON.parse(fs.readFileSync(`${ROOT}/layers.json`, "utf8"));
    for (const engine of ["flutter", "roblox", "unity"]) {
      expect(data.engines[engine]?.length, engine).toBeGreaterThan(0);
    }
  });
});

// 검증 대상(ToonTone)이 Flutter 폰게임인데 스택 스킬이 없어 하네스가 정식으로 못 붙었다.
describe("flutter 스택", () => {
  it("스킬이 있고 자기 어댑터를 가리킨다", () => {
    expect(fs.existsSync(`${ROOT}/skills/flutter/SKILL.md`)).toBe(true);
    const text = fs.readFileSync(`${ROOT}/skills/flutter/SKILL.md`, "utf8");
    expect(text).toContain("flutter-stack.mjs");
    expect(text).toContain("detectFlutterGame");
  });

  it("스택을 다시 선언하지 않는다 — 코어 stack.mjs 가 이미 판정한다", () => {
    const ext = JSON.parse(fs.readFileSync(`${ROOT}/nereus-extension.json`, "utf8"));
    expect((ext.stacks ?? []).map((s: any) => s.name)).not.toContain("flutter");
  });
});

