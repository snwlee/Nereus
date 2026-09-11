import { describe, it, expect } from "vitest";
import { readInventory } from "../../plugins/nereus/hooks/scripts/lib/plugin-inventory.mjs";

const deps = {
  readJson: (p: string) => ({
    "/p/installed.json": { version: 2, plugins: { "ecc@ecc": [{ installPath: "/i/ecc", version: "2.0.0" }] } },
    "/p/settings.json": { enabledPlugins: { "ecc@ecc": false } },
    "/i/ecc/.mcp.json": { mcpServers: { "chrome-devtools": {} } },
    "/i/ecc/hooks/hooks.json": { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [] }] } },
  }[p]),
  readDir: (p: string) => ({ "/i/ecc/skills": ["unified-memory"], "/i/ecc/agents": ["reviewer.md"], "/i/ecc/bin": ["ecc"] }[p] ?? []),
};

describe("readInventory", () => {
  it("reads enabled state from settings, not from presence on disk", () => {
    const rows = readInventory({ pluginsFile: "/p/installed.json", settingsFile: "/p/settings.json", ...deps });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "ecc@ecc", version: "2.0.0", enabled: false });
  });
  it("collects every conflict surface", () => {
    const s = readInventory({ pluginsFile: "/p/installed.json", settingsFile: "/p/settings.json", ...deps })[0].surfaces;
    expect(s.mcp).toEqual(["chrome-devtools"]);
    expect(s.skills).toEqual(["unified-memory"]);
    expect(s.agents).toEqual(["reviewer"]);
    expect(s.bins).toEqual(["ecc"]);
    expect(s.hooks).toEqual([{ event: "PostToolUse", matcher: "Edit" }]);
  });
  it("returns empty surfaces instead of throwing when a plugin has none", () => {
    const rows = readInventory({
      pluginsFile: "/p/installed.json", settingsFile: "/p/settings.json",
      readJson: (p: string) => (p === "/p/installed.json" ? { plugins: { "bare@x": [{ installPath: "/i/bare", version: "1" }] } } : p === "/p/settings.json" ? { enabledPlugins: { "bare@x": true } } : undefined),
      readDir: () => [],
    });
    expect(rows[0].surfaces).toEqual({ skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null });
  });
});
