// 회귀: doctor 는 라이브러리 전부(runDoctor · structuralConflicts · curatedConflicts ·
// readInventory · 원장 I/O)가 단위 테스트 초록이었는데 **프로세스로 묶는 진입점이 없었다.**
// `node doctor.mjs` 가 0바이트를 내고 exit 0 으로 끝났다 — SKILL.md 와 setup 이 문서화한
// 바로 그 명령이다. SessionStart 는 새 플러그인을 발견하면 여기로 보낸다.
// **픽스처 초록은 검증이 아니다.** 부르는 곳이 없으면 그것은 게이트가 아니다.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DOCTOR = "plugins/nereus/skills/doctor/scripts/doctor.mjs";

let home = "";
let project = "";
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-doctor-home-"));
  project = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-doctor-proj-"));
});
afterEach(() => {
  for (const d of [home, project]) fs.rmSync(d, { recursive: true, force: true });
});

/** 홈에 installed_plugins.json 과 settings.json 을 깐다. 사용자 실제 홈을 절대 읽지 않는다. */
const seed = (plugins: any, settings: any) => {
  const dir = path.join(home, ".claude", "plugins");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "installed_plugins.json"), JSON.stringify(plugins));
  fs.writeFileSync(path.join(home, ".claude", "settings.json"), JSON.stringify(settings));
};

const run = (args: string[] = []) =>
  execFileSync("node", [DOCTOR, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, HOME: home, NEREUS_DOCTOR_CWD: project },
    stdio: ["pipe", "pipe", "pipe"],
  });

describe("doctor 실행 진입점", () => {
  it("충돌이 없으면 그렇게 말한다 — 0바이트로 끝나지 않는다", () => {
    seed({ version: 2, plugins: {} }, { enabledPlugins: {} });
    const out = run();
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("충돌 없음");
  });

  it("같은 MCP 서버명을 쓰는 두 플러그인을 HIGH 로 보고한다", () => {
    const surfaces = (dir: string) => {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { "chrome-devtools": {} } }));
    };
    const a = path.join(home, "pa");
    const b = path.join(home, "pb");
    surfaces(a);
    surfaces(b);
    seed(
      { version: 2, plugins: { "a@m": [{ installPath: a, version: "1.0.0" }], "b@m": [{ installPath: b, version: "1.0.0" }] } },
      { enabledPlugins: { "a@m": true, "b@m": true } },
    );
    const out = run();
    expect(out).toContain("HIGH");
    expect(out).toContain("chrome-devtools");
  });

  it("--remove 는 명령 문자열만 낸다 — 실행하지 않는다", () => {
    seed({ version: 2, plugins: {} }, { enabledPlugins: {} });
    expect(run(["--remove", "ecc@ecc"])).toContain("/plugin uninstall ecc@ecc");
  });

  it("인자 없이는 아무 파일도 쓰지 않는다 — 기본은 읽기 전용이다", () => {
    seed({ version: 2, plugins: {} }, { enabledPlugins: {} });
    const before = fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8");
    run();
    expect(fs.readFileSync(path.join(home, ".claude", "settings.json"), "utf8")).toBe(before);
    expect(fs.existsSync(path.join(home, ".config", "nereus", "doctor-ledger.jsonl"))).toBe(false);
  });

  it("--ack 는 원장에 한 줄을 남기고 그 충돌은 다음 실행에서 빠진다", () => {
    seed({ version: 2, plugins: {} }, { enabledPlugins: {} });
    const out = run(["--ack", "deadbeef"]);
    expect(out).toContain("deadbeef");
    const ledger = path.join(home, ".config", "nereus", "doctor-ledger.jsonl");
    expect(fs.existsSync(ledger)).toBe(true);
    expect(JSON.parse(fs.readFileSync(ledger, "utf8").trim()).fingerprint).toBe("deadbeef");
  });

  it("사용자 홈을 읽지 않는다 — HOME 격리가 실제로 먹는다", () => {
    // installed_plugins.json 을 아예 안 깐다. 실제 홈을 봤다면 진짜 플러그인들이 나온다.
    const out = run();
    expect(out).toContain("충돌 없음");
    expect(out).not.toContain("nereus-game");
  });
});
