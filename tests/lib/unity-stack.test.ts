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

// ── 에디터 실시간 제어(Unity CLI + Pipeline 패키지 + MCP) ─────────────────
import { detectUnityEditorLink } from "../../plugins/nereus-game/lib/unity-stack.mjs";

const link = (o: {
  files?: Record<string, unknown>;
  cli?: string | null;
}) => {
  const files = o.files ?? {};
  return {
    findCli: () => (o.cli === undefined ? "/u/.unity/bin/unity" : o.cli),
    readJson: (p: string) => files[p.replace(/\\/g, "/")],
    exists: (p: string) => p.replace(/\\/g, "/") in files,
    claudeJson: "/h/.claude.json",
  };
};
const PV = "/p/ProjectSettings/ProjectVersion.txt";
const MANIFEST = "/p/Packages/manifest.json";
const withPipeline = { dependencies: { "com.unity.pipeline": "0.7.0-exp.1" } };
const mcpProject = { mcpServers: { "unity-editor-mcp": { command: "unity", args: ["mcp"] } } };

describe("detectUnityEditorLink", () => {
  it("Unity 프로젝트가 아니면 null", () => {
    expect(detectUnityEditorLink("/p", link({}))).toBeNull();
  });

  it("CLI·pipeline·MCP 가 다 있으면 ready 이고 live", () => {
    const out = detectUnityEditorLink(
      "/p",
      link({ files: { [PV]: "", [MANIFEST]: withPipeline, "/p/.mcp.json": mcpProject } }),
    );
    expect(out).toMatchObject({ status: "ready", live: true, missing: [] });
    expect(out?.cli).toBe("/u/.unity/bin/unity");
  });

  it("MCP 만 없으면 partial 이지만 CLI 로 live 제어는 된다", () => {
    const out = detectUnityEditorLink("/p", link({ files: { [PV]: "", [MANIFEST]: withPipeline } }));
    expect(out).toMatchObject({ status: "partial", live: true, missing: ["mcp"] });
  });

  it("pipeline 패키지가 없으면 live 가 아니다", () => {
    const out = detectUnityEditorLink(
      "/p",
      link({ files: { [PV]: "", [MANIFEST]: { dependencies: {} }, "/p/.mcp.json": mcpProject } }),
    );
    expect(out).toMatchObject({ status: "partial", live: false, missing: ["pipeline"] });
  });

  it("아무것도 없으면 absent 이고 빠진 것을 다 적는다", () => {
    const out = detectUnityEditorLink(
      "/p",
      link({ cli: null, files: { [PV]: "", [MANIFEST]: { dependencies: {} } } }),
    );
    expect(out).toMatchObject({ status: "absent", live: false, missing: ["cli", "pipeline", "mcp"] });
  });

  it("전역·프로젝트별 ~/.claude.json 등록도 MCP 로 인정한다", () => {
    const out = detectUnityEditorLink(
      "/p",
      link({
        files: {
          [PV]: "",
          [MANIFEST]: withPipeline,
          "/h/.claude.json": { projects: { "/p": mcpProject } },
        },
      }),
    );
    expect(out?.missing).toEqual([]);
  });

  it("unity 가 아닌 MCP 서버는 인정하지 않는다", () => {
    const out = detectUnityEditorLink(
      "/p",
      link({
        files: {
          [PV]: "",
          [MANIFEST]: withPipeline,
          "/p/.mcp.json": { mcpServers: { other: { command: "npx", args: ["unity-mcp-lookalike"] } } },
        },
      }),
    );
    expect(out?.missing).toEqual(["mcp"]);
  });

  it("매니페스트를 못 읽으면 pipeline 을 없다고 단정하지 않고 사유를 남긴다", () => {
    const out = detectUnityEditorLink("/p", link({ files: { [PV]: "", "/p/.mcp.json": mcpProject } }));
    expect(out?.live).toBe(false);
    expect(out?.why).toContain("manifest");
  });
});
