import { describe, it, expect } from "vitest";
import { parseDesignDiff, designTouched, fileHashes, recordRound, readRounds, designGate } from "../../plugins/nereus/hooks/scripts/lib/design.mjs";

const d = (s: string) => s.replace(/^\n/, "");

describe("parseDesignDiff", () => {
  it("marks a file with 'new file mode' as created", () => {
    const files = parseDesignDiff(d(`
diff --git a/src/hero.css b/src/hero.css
new file mode 100644
--- /dev/null
+++ b/src/hero.css
+.hero { color: red; }
`));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ file: "src/hero.css", created: true });
    expect(files[0].added).toEqual([".hero { color: red; }"]);
  });
  it("marks a file with a real a/ side as modified, not created", () => {
    const files = parseDesignDiff(d(`
diff --git a/src/hero.css b/src/hero.css
--- a/src/hero.css
+++ b/src/hero.css
+.hero { color: blue; }
-.hero { color: red; }
`));
    expect(files[0]).toMatchObject({ file: "src/hero.css", created: false });
    expect(files[0].removed).toEqual([".hero { color: red; }"]);
  });
  it("treats the untracked fake diff (no --- header) as created", () => {
    const files = parseDesignDiff(d(`
diff --git a/src/new.css b/src/new.css
+++ b/src/new.css
+.a{}
`));
    expect(files[0]).toMatchObject({ file: "src/new.css", created: true });
  });
});

describe("designTouched", () => {
  it("counts any stylesheet as a design surface without needing signals", () => {
    const t = designTouched(d(`
diff --git a/src/a.scss b/src/a.scss
--- a/src/a.scss
+++ b/src/a.scss
+$gap: 4px;
`));
    expect(t.map((f) => f.file)).toEqual(["src/a.scss"]);
    expect(t[0].why).toBe("stylesheet");
  });
  it("counts a component file only when the added lines carry visual signals", () => {
    const visual = designTouched(d(`
diff --git a/src/Card.tsx b/src/Card.tsx
--- a/src/Card.tsx
+++ b/src/Card.tsx
+  return <div className="rounded-xl p-6">{title}</div>;
`));
    expect(visual.map((f) => f.file)).toEqual(["src/Card.tsx"]);
    const logic = designTouched(d(`
diff --git a/src/useCart.tsx b/src/useCart.tsx
--- a/src/useCart.tsx
+++ b/src/useCart.tsx
+  const total = items.reduce((a, b) => a + b.price, 0);
`));
    expect(logic).toEqual([]);
  });
  it("catches Flutter widget styling", () => {
    const t = designTouched(d(`
diff --git a/lib/hero.dart b/lib/hero.dart
--- a/lib/hero.dart
+++ b/lib/hero.dart
+  padding: const EdgeInsets.all(16),
`));
    expect(t.map((f) => f.file)).toEqual(["lib/hero.dart"]);
  });
  it("ignores tests, docs and excluded globs", () => {
    const diff = d(`
diff --git a/tests/Card.test.tsx b/tests/Card.test.tsx
--- a/tests/Card.test.tsx
+++ b/tests/Card.test.tsx
+  expect(<div className="x" />).toBeTruthy();
diff --git a/docs/style.md b/docs/style.md
--- a/docs/style.md
+++ b/docs/style.md
+색상: --color-accent
diff --git a/vendor/theme.css b/vendor/theme.css
--- a/vendor/theme.css
+++ b/vendor/theme.css
+.x{}
`);
    expect(designTouched(diff)).toEqual([]);
    expect(designTouched(diff + d(`
diff --git a/src/x.css b/src/x.css
--- a/src/x.css
+++ b/src/x.css
+.y{}
`), { exclude: ["src/**"] })).toEqual([]);
  });
});

describe("round records", () => {
  const io = () => {
    let store: string | null = null;
    return {
      readFile: () => { if (store === null) throw new Error("ENOENT"); return store; },
      writeFile: (_: string, s: string) => { store = s; },
    };
  };
  it("appends rounds and reads them back newest last", () => {
    const deps = io();
    expect(readRounds("/r", deps)).toEqual([]);
    recordRound("/r", { phase: "direction", source: "agy", verdict: "OK", files: {} }, { ...deps, now: 1 });
    recordRound("/r", { phase: "visual", source: "gemini-web", verdict: "REVISE", files: { "a.css": "h1" } }, { ...deps, now: 2 });
    const rounds = readRounds("/r", deps);
    expect(rounds).toHaveLength(2);
    expect(rounds[1]).toMatchObject({ phase: "visual", verdict: "REVISE", at: 2 });
  });
  it("keeps only the most recent rounds so the file cannot grow forever", () => {
    const deps = io();
    for (let i = 0; i < 30; i++) recordRound("/r", { phase: "visual", source: "agy", verdict: "OK", files: {} }, { ...deps, now: i });
    const rounds = readRounds("/r", deps);
    expect(rounds).toHaveLength(20);
    expect(rounds[rounds.length - 1].at).toBe(29);
  });
  it("hashes file contents so an edit invalidates coverage", () => {
    const h1 = fileHashes("/r", ["a.css"], () => ".a{}");
    const h2 = fileHashes("/r", ["a.css"], () => ".a{color:red}");
    expect(h1["a.css"]).toMatch(/^[0-9a-f]{16}$/);
    expect(h2["a.css"]).not.toBe(h1["a.css"]);
    expect(fileHashes("/r", ["gone.css"], () => { throw new Error("ENOENT"); })).toEqual({ "gone.css": "" });
  });
});

describe("designGate", () => {
  const touched = [{ file: "src/hero.css", why: "stylesheet" }];
  const hashes = { "src/hero.css": "h1" };

  it("blocks when a design change has no Gemini feedback at all", () => {
    const r = designGate({ touched, hashes, created: [], rounds: [] });
    expect(r.pass).toBe(false);
    expect(r.findings[0]).toMatchObject({ category: "design_feedback_missing", file: "src/hero.css" });
  });
  it("passes when a visual round with verdict OK covers the current file hash", () => {
    const rounds = [{ phase: "visual", verdict: "OK", files: { "src/hero.css": "h1" }, at: 1 }];
    expect(designGate({ touched, hashes, created: [], rounds }).pass).toBe(true);
  });
  it("blocks when the covering round is stale (file changed after the critique)", () => {
    const rounds = [{ phase: "visual", verdict: "OK", files: { "src/hero.css": "old" }, at: 1 }];
    const r = designGate({ touched, hashes, created: [], rounds });
    expect(r.pass).toBe(false);
    expect(r.findings[0].category).toBe("design_feedback_stale");
  });
  it("blocks when the latest critique said REVISE and nothing changed since", () => {
    const rounds = [{ phase: "visual", verdict: "REVISE", files: { "src/hero.css": "h1" }, at: 1, notes: "계층 없음" }];
    const r = designGate({ touched, hashes, created: [], rounds });
    expect(r.pass).toBe(false);
    expect(r.findings[0].category).toBe("design_feedback_unaddressed");
    expect(r.findings[0].message).toContain("계층 없음");
  });
  it("requires a direction round too when a design file is newly created", () => {
    const rounds = [{ phase: "visual", verdict: "OK", files: { "src/hero.css": "h1" }, at: 1 }];
    const r = designGate({ touched, hashes, created: ["src/hero.css"], rounds });
    expect(r.pass).toBe(false);
    expect(r.findings.map((f: any) => f.category)).toContain("design_direction_missing");
    const withDirection = [{ phase: "direction", verdict: "OK", files: {}, at: 0 }, ...rounds];
    expect(designGate({ touched, hashes, created: ["src/hero.css"], rounds: withDirection }).pass).toBe(true);
  });
  it("passes trivially when no design surface was touched", () => {
    expect(designGate({ touched: [], hashes: {}, created: [], rounds: [] })).toMatchObject({ pass: true, findings: [] });
  });
  it("reports findings but does not block when enforce is warn", () => {
    const r = designGate({ touched, hashes, created: [], rounds: [], enforce: "warn" });
    expect(r.pass).toBe(true);
    expect(r.findings).toHaveLength(1);
  });
});
