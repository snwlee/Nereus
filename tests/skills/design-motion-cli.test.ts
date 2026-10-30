import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(process.cwd(), "plugins/nereus/skills/design/scripts/motion-check.mjs");
let repo = "";
const git = (...a: string[]) => execFileSync("git", a, { cwd: repo });
const run = (args: string[]) => spawnSync("node", [CLI, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, NEREUS_HOME: repo } });

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "motion-"));
  git("init", "-q");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
  writeFileSync(join(repo, "a.css"), ".a {\n  transition: all 300ms ease-in;\n}\n");
});

describe("design-motion.cli [flow]", () => {
  it("미커밋 새 파일의 지적을 보고하고 0 으로 끝난다", () => {
    const r = run([]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("transition-all");
    expect(r.stdout).toContain("a.css:2");
  });
  it("--strict 면 1", () => {
    expect(run(["--strict"]).status).toBe(1);
  });
  it("커밋된 전역 reduced-motion 이 있으면 no-reduced-motion 을 내지 않는다", () => {
    writeFileSync(join(repo, "globals.css"), "@media (prefers-reduced-motion: reduce) { * { transition: none !important } }\n");
    git("add", "globals.css");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "global");
    const r = run([]);
    expect(r.stdout).toContain("transition-all");
    expect(r.stdout).not.toContain("no-reduced-motion");
  });
});
