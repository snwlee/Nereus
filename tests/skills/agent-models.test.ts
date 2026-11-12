import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_TIERS } from "../../plugins/nereus/skills/spec/scripts/model-tiers.mjs";

const PLUGINS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../plugins");

// plugins/<플러그인>/agents/<이름>.md → 키 "<플러그인>/<이름>"
const agentFiles = () => fs.readdirSync(PLUGINS).flatMap((p) => {
  const d = path.join(PLUGINS, p, "agents");
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => ({ file: path.join(d, f), key: `${p}/${f.slice(0, -3)}` })) : [];
});
// 첫 frontmatter 블록만 읽는다 — 본문의 --- 에 걸리지 않게 앵커를 건다.
const frontmatter = (file: string) => {
  const m = fs.readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out: Record<string, string> = {};
  for (const line of (m?.[1] ?? "").split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
};

describe("agent frontmatter matches the tier table", () => {
  it("the agent files and the table have the same keys", () => {
    expect(agentFiles().map((f) => f.key).sort()).toEqual(Object.keys(AGENT_TIERS).sort());
  });
  it("every agent declares the table's model and effort", () => {
    for (const { file, key } of agentFiles()) {
      const fm = frontmatter(file);
      expect({ key, model: fm.model, effort: fm.effort }).toEqual({ key, ...AGENT_TIERS[key as keyof typeof AGENT_TIERS] });
    }
  });
});
