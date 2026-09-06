import { describe, it, expect } from "vitest";
import { DEFAULTS, mergeConfig, loadConfig } from "../../plugins/nereus/hooks/scripts/lib/config.mjs";

describe("config", () => {
  it("has sane defaults", () => {
    expect(DEFAULTS.secondOpinion).toBe("both");
    expect(DEFAULTS.baton).toEqual({ warn: 0.5, hard: 0.7 });
    expect(DEFAULTS.pdf.engine).toBe("typst");
    expect(DEFAULTS.image.backend).toBe("auto");
    expect(DEFAULTS.autoClear.enabled).toBe(true);
  });
  it("deep-merges user then project over defaults without mutating inputs", () => {
    const user = { baton: { warn: 0.4 } };
    const project = { secondOpinion: "gemini", tdd: { exclude: ["**/*.gen.ts"] } };
    const merged = mergeConfig(DEFAULTS, user, project);
    expect(merged.baton).toEqual({ warn: 0.4, hard: 0.7 });
    expect(merged.secondOpinion).toBe("gemini");
    expect(merged.tdd.exclude).toEqual(["**/*.gen.ts"]);
    expect(user).toEqual({ baton: { warn: 0.4 } });
    expect(DEFAULTS.baton.warn).toBe(0.5);
  });
  it("loadConfig reads JSON files via injected reader and ignores missing or invalid ones", () => {
    const files: Record<string, string> = { "/u/nereus/config.json": '{"baton":{"hard":0.9}}', "/p/.nereus/config.json": "not json" };
    const readFile = (p: string) => { const k = p.replace(/\\/g, "/"); if (!(k in files)) throw new Error("ENOENT"); return files[k]; };
    const cfg = loadConfig({ userDir: "/u/nereus", projectDir: "/p/.nereus", readFile });
    expect(cfg.baton).toEqual({ warn: 0.5, hard: 0.9 });
  });
});
