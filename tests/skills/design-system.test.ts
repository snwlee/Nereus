import { describe, it, expect } from "vitest";
import {
  ENGINE_CANDIDATES,
  resolveEngine,
  buildArgs,
  briefPath,
  slugify,
  missingEngineNotice,
  planGenerate,
} from "../../plugins/nereus/skills/design/scripts/design-system.mjs";

const exists = (allowed: string[]) => (p: string) => allowed.includes(p);

describe("resolveEngine", () => {
  it("prefers NEREUS_UIUX_HOME when its search.py is present", () => {
    const home = "/opt/uupm";
    const script = "/opt/uupm/scripts/search.py";
    const r = resolveEngine({ env: { NEREUS_UIUX_HOME: home }, home: "/home/u", exists: exists([script]) });
    expect(r).toEqual({ root: home, script });
  });

  it("falls back to the sparse clone under ~/.local/share/nereus", () => {
    const root = "/home/u/.local/share/nereus/ui-ux-pro-max/.claude/skills/ui-ux-pro-max";
    const r = resolveEngine({ env: {}, home: "/home/u", exists: exists([`${root}/scripts/search.py`]) });
    expect(r?.root).toBe(root);
  });

  it("also accepts a global or project skill install", () => {
    const global = "/home/u/.claude/skills/ui-ux-pro-max";
    expect(resolveEngine({ env: {}, home: "/home/u", exists: exists([`${global}/scripts/search.py`]) })?.root).toBe(global);

    const project = "/repo/.claude/skills/ui-ux-pro-max";
    expect(resolveEngine({ env: {}, home: "/home/u", cwd: "/repo", exists: exists([`${project}/scripts/search.py`]) })?.root).toBe(project);
  });

  it("returns null when no candidate holds the entry script", () => {
    expect(resolveEngine({ env: {}, home: "/home/u", exists: () => false })).toBeNull();
  });

  it("never looks outside the declared candidates", () => {
    const seen: string[] = [];
    resolveEngine({ env: {}, home: "/home/u", cwd: "/repo", exists: (p: string) => { seen.push(p); return false; } });
    const roots = seen.map((p) => p.replace(/\/scripts\/search\.py$/, ""));
    expect(roots).toEqual(ENGINE_CANDIDATES({ env: {}, home: "/home/u", cwd: "/repo" }));
  });
});

describe("buildArgs", () => {
  it("always requests a markdown design system so the brief needs no parsing", () => {
    const a = buildArgs({ query: "developer harness dashboard" });
    expect(a[0]).toBe("developer harness dashboard");
    expect(a).toContain("--design-system");
    expect(a).toContain("--format");
    expect(a[a.indexOf("--format") + 1]).toBe("markdown");
  });

  it("passes the project name and stack through", () => {
    const a = buildArgs({ query: "q", projectName: "Nereus", stack: "nextjs" });
    expect(a[a.indexOf("--project-name") + 1]).toBe("Nereus");
    expect(a[a.indexOf("--stack") + 1]).toBe("nextjs");
  });

  it("forwards the variance/motion/density dials only when given", () => {
    const a = buildArgs({ query: "q", variance: 7, motion: 3, density: 8 });
    expect(a[a.indexOf("--variance") + 1]).toBe("7");
    expect(a[a.indexOf("--motion") + 1]).toBe("3");
    expect(a[a.indexOf("--density") + 1]).toBe("8");
    expect(buildArgs({ query: "q" })).not.toContain("--variance");
  });

  it("rejects out-of-range dials instead of letting python fail late", () => {
    expect(() => buildArgs({ query: "q", variance: 0 })).toThrow(/variance/);
    expect(() => buildArgs({ query: "q", density: 11 })).toThrow(/density/);
    expect(() => buildArgs({ query: "q", motion: 2.5 })).toThrow(/motion/);
  });

  it("requires a query", () => {
    expect(() => buildArgs({ query: "  " })).toThrow(/query/);
  });

  it("never passes --persist: the engine must not write into the repo itself", () => {
    expect(buildArgs({ query: "q", projectName: "p" })).not.toContain("--persist");
  });
});

describe("slugify / briefPath", () => {
  it("collapses everything unsafe into a single path segment", () => {
    expect(slugify("Nereus Harness")).toBe("nereus-harness");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
    expect(slugify("결제 완료")).toBe("design");
  });

  it("writes under docs/design as <slug>-system.md", () => {
    expect(briefPath({ cwd: "/repo", slug: "hero" })).toBe("/repo/docs/design/hero-system.md");
  });
});

describe("missingEngineNotice", () => {
  it("names the install command and the config switch to turn the step off", () => {
    const n = missingEngineNotice();
    expect(n).toMatch(/ui-ux-pro-max/);
    expect(n).toMatch(/git clone/);
    expect(n).toMatch(/systemGenerator/);
    expect(n).toMatch(/NEREUS_UIUX_HOME/);
  });
});

describe("planGenerate", () => {
  it("plans a python3 run of the resolved script and a write to the brief path", () => {
    const plan = planGenerate({
      query: "harness dashboard",
      projectName: "Nereus",
      cwd: "/repo",
      engine: { root: "/opt/uupm", script: "/opt/uupm/scripts/search.py" },
    });
    expect(plan.ok).toBe(true);
    expect(plan.cmd).toBe("python3");
    expect(plan.args[0]).toBe("/opt/uupm/scripts/search.py");
    expect(plan.args).toContain("--design-system");
    expect(plan.cwd).toBe("/opt/uupm");
    expect(plan.out).toBe("/repo/docs/design/nereus-system.md");
  });

  it("derives the slug from the query when no project name is given", () => {
    const plan = planGenerate({ query: "Payment Hero", cwd: "/repo", engine: { root: "/e", script: "/e/scripts/search.py" } });
    expect(plan.out).toBe("/repo/docs/design/payment-hero-system.md");
  });

  it("reports the notice instead of a command when the engine is absent", () => {
    const plan = planGenerate({ query: "q", cwd: "/repo", engine: null });
    expect(plan.ok).toBe(false);
    expect(plan.notice).toMatch(/ui-ux-pro-max/);
    expect(plan.cmd).toBeUndefined();
  });
});
