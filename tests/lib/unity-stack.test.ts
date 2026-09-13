import { describe, it, expect } from "vitest";
import { detectUnityRunner, detectUnityAgentPlugin } from "../../plugins/nereus-game/lib/unity-stack.mjs";

const fsWith = (files: string[], manifest = "") => ({
  exists: (p: string) => files.some((f) => p.replace(/\\/g, "/").endsWith(f)),
  readFile: () => manifest,
});

describe("detectUnityRunner", () => {
  it("테스트 프레임워크가 있으면 batchmode 러너", () => {
    const fsx = fsWith(
      ["ProjectSettings/ProjectVersion.txt", "Packages/manifest.json"],
      JSON.stringify({ dependencies: { "com.unity.test-framework": "1.4.5" } }),
    );
    const out = detectUnityRunner("/p", fsx);
    expect(out?.runner).toBe("unity-test-framework");
    expect(out?.command).toContain("-batchmode");
  });

  it("테스트 프레임워크가 없으면 null", () => {
    const fsx = fsWith(
      ["ProjectSettings/ProjectVersion.txt", "Packages/manifest.json"],
      JSON.stringify({ dependencies: {} }),
    );
    expect(detectUnityRunner("/p", fsx)).toBeNull();
  });

  it("Unity 프로젝트가 아니면 null", () => {
    expect(detectUnityRunner("/p", fsWith(["package.json"]))).toBeNull();
  });
});

const PLUGIN = "unity@unity-agent-plugin";
const inv = (json: Record<string, unknown>) => ({
  pluginsFile: "/p/installed.json",
  settingsFile: "/p/settings.json",
  readJson: (p: string) => (json as Record<string, any>)[p],
});

describe("detectUnityAgentPlugin", () => {
  it("설치되어 활성이면 ready 이고 위임한다", () => {
    const out = detectUnityAgentPlugin(
      inv({
        "/p/installed.json": { plugins: { [PLUGIN]: [{ scope: "project", version: "1.2.0" }] } },
        "/p/settings.json": { enabledPlugins: { [PLUGIN]: true } },
      }),
    );
    expect(out).toMatchObject({ status: "ready", delegate: true, version: "1.2.0", scope: "project" });
  });

  it("설정에서 꺼져 있으면 디스크에 있어도 disabled", () => {
    const out = detectUnityAgentPlugin(
      inv({
        "/p/installed.json": { plugins: { [PLUGIN]: [{ scope: "user", version: "1.2.0" }] } },
        "/p/settings.json": { enabledPlugins: { [PLUGIN]: false } },
      }),
    );
    expect(out).toMatchObject({ status: "disabled", delegate: false });
  });

  it("인벤토리에 없으면 absent", () => {
    const out = detectUnityAgentPlugin(
      inv({ "/p/installed.json": { plugins: { "codex@openai-codex": [{}] } }, "/p/settings.json": {} }),
    );
    expect(out).toMatchObject({ status: "absent", delegate: false });
  });

  it("인벤토리를 못 읽으면 absent 가 아니라 unknown 이고 사유가 남는다", () => {
    const out = detectUnityAgentPlugin({
      pluginsFile: "/p/installed.json",
      settingsFile: "/p/settings.json",
      readJson: () => undefined,
    });
    expect(out.status).toBe("unknown");
    expect(out.delegate).toBe(false);
    expect(out.why).toBeTruthy();
  });

  it("전역 스코프면 advice 로 알린다", () => {
    const out = detectUnityAgentPlugin(
      inv({
        "/p/installed.json": { plugins: { [PLUGIN]: [{ scope: "user", version: "1.2.0" }] } },
        "/p/settings.json": {},
      }),
    );
    expect(out.status).toBe("ready");
    expect(out.advice).toContain("scope-user");
  });
});
