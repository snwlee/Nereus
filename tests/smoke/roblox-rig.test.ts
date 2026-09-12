// 실제 로블록스 프로젝트 모양의 임시 저장소를 만들고, **코어 훅을 자식 프로세스로** 돌린다.
//
// 왜 프로세스인가: 이 하네스의 결함은 4사이클 내내 "단위 테스트는 초록인데 프로덕션에서 안 도는"
// 모양으로 나왔다(가짜 픽스처 · 미배선 확장점 · 코어가 모르는 확장자). 라이브러리를 직접 부르면
// 그 계층을 건너뛰므로, 설치 기록 파일 → loadExtensions → 스택 판정 → 훅 출력까지 전부 통과시킨다.
//
// HOME 을 임시 디렉터리로 격리해 사용자 전역 설정을 읽지 않게 한다.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = process.cwd();
const CORE = path.join(REPO, "plugins", "nereus");
const GAME = path.join(REPO, "plugins", "nereus-game");

let rig = "";
const game = () => path.join(rig, "game");

function hook(script: string, payload: object) {
  const r = spawnSync(process.execPath, [path.join(CORE, "hooks", "scripts", script)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    cwd: game(),
    env: { ...process.env, HOME: path.join(rig, "home"), USERPROFILE: path.join(rig, "home") },
  });
  return { out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim(), status: r.status };
}

const writeEvent = (file: string) => ({
  tool_name: "Write",
  tool_input: { file_path: path.join(game(), file) },
  session_id: `rig-${Math.random().toString(36).slice(2)}`,
  cwd: game(),
});

beforeAll(() => {
  rig = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-roblox-rig-"));
  fs.mkdirSync(path.join(rig, "home", ".claude", "plugins"), { recursive: true });
  fs.mkdirSync(path.join(game(), "src", "server"), { recursive: true });
  fs.mkdirSync(path.join(game(), "tests"), { recursive: true });

  // 실제 형태: plugins 는 "name@marketplace" 키의 객체이고 값은 배열이다.
  fs.writeFileSync(path.join(rig, "home", ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
    version: 2,
    plugins: {
      "nereus@nereus": [{ scope: "user", installPath: CORE, version: "0.0.0" }],
      "nereus-game@nereus": [{ scope: "user", installPath: GAME, version: "0.0.0" }],
    },
  }));
  fs.writeFileSync(path.join(rig, "home", ".claude", "settings.json"), JSON.stringify({
    enabledPlugins: { "nereus@nereus": true, "nereus-game@nereus": true },
  }));

  fs.writeFileSync(path.join(game(), "default.project.json"), JSON.stringify({ name: "Rig", tree: { $className: "DataModel" } }));
  fs.writeFileSync(path.join(game(), "lune.yaml"), "target = \"tests\"\n");
  fs.writeFileSync(path.join(game(), "src", "server", "Economy.luau"), "local M = {}\nreturn M\n");
});

afterAll(() => { try { fs.rmSync(rig, { recursive: true, force: true }); } catch { /* 정리 실패는 무시 */ } });

describe("로블록스 리그 — 훅 프로세스", () => {
  it("skill-router 가 설치 기록을 읽어 게임 스킬로 라우팅한다", () => {
    const r = hook("skill-router.mjs", { prompt: "로블록스 타이쿤 수익 밸런스 잡아줘", session_id: "rig-route", cwd: game() });
    expect(r.out).toContain("nereus-game:roblox");
    expect(r.out).toContain("nereus-game:balance");
  });

  it("tdd-guard 가 테스트 없는 .luau 편집에 경고한다", () => {
    const r = hook("tdd-guard.mjs", writeEvent("src/server/Economy.luau"));
    expect(r.out).toContain("[TDD]");
    expect(r.out).toContain("lune run tests");
  });

  it("tdd-guard 는 테스트 파일 편집에는 조용하다", () => {
    const r = hook("tdd-guard.mjs", writeEvent("tests/Economy.spec.luau"));
    expect(r.out).toBe("");
  });

  it("차단 모드에서 .luau 구현 편집이 실제로 막힌다", () => {
    fs.mkdirSync(path.join(game(), ".nereus"), { recursive: true });
    fs.writeFileSync(path.join(game(), ".nereus", "config.json"), JSON.stringify({ tdd: { enforce: "block" } }));
    const r = hook("pre-tool-guard.mjs", writeEvent("src/server/Economy.luau"));
    // 차단은 Claude Code 훅 규약대로 exit 2 + stderr 로 나간다. stdout 이 아니다.
    expect(r.status).toBe(2);
    expect(r.err).toContain("[nereus:tdd]");
    expect(r.err).toContain("Economy.luau");
  });

  it("유니티 스택이 없는 저장소에서 .cs 는 소스로 잡히지 않는다 — 규칙은 감지된 스택으로 좁혀진다", () => {
    const r = hook("pre-tool-guard.mjs", writeEvent("src/server/Player.cs"));
    expect(r.status).toBe(0);
    expect(r.err).toBe("");
  });
});
