import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scanGate } from "../../plugins/nereus/skills/skill-audit/scripts/scan-gate.mjs";

// 2026-11-12 실측: skillspector 2.11 은 `--json` 옵션이 없고(`--format json`), 보고서는 `issues` 키에 지적을 담는다.
// 이전 게이트는 `findings` 만 읽어 실제 보고서를 전부 "형식 깨짐"으로 막았다(설치 게이트가 사실상 꺼져 있었다).
// SkillEvaluator 0.8 `validate --type plugin` 이 frontmatter 35/48 의 엄격 YAML 오류와 phone 예시의 실제 업소 번호를 찾았다.

const P = "plugins/nereus";
const read = (f: string) => fs.readFileSync(`${P}/${f}`, "utf8");

// skillspector 2.11.0 의 실제 보고서 모양(값만 줄였다)
const real = (o: Record<string, unknown> = {}) => ({
  skill: { name: "x" },
  risk_assessment: { score: 10, severity: "LOW", recommendation: "SAFE_TO_INSTALL", max_issue_severity: "LOW" },
  issues: [{ id: "PE1", severity: "LOW", finding: "skip permission check", location: { file: "a.md", start_line: 1 } }],
  execution_successful: true,
  analysis_completeness: { is_complete: true, status: "complete" },
  ...o,
});

describe("scanGate 는 실제 skillspector 보고서를 읽는다", () => {
  it("issues 키를 읽고 대문자 심각도를 판정한다", () => {
    const r = scanGate(real({ issues: [{ id: "PE3", severity: "HIGH", finding: "credentials.json" }, { id: "EA2", severity: "MEDIUM" }] }));
    expect(r.install).toBe(false);
    expect(r.blocking.map((x: any) => x.id)).toEqual(["PE3"]);
    expect(r.warnings.map((x: any) => x.id)).toEqual(["EA2"]);
  });
  it("깨끗한 실제 보고서는 통과한다", () => {
    expect(scanGate(real({ issues: [] })).install).toBe(true);
  });
  it("스캔 실행이 실패했으면 막는다(fail-closed)", () => {
    const r = scanGate(real({ issues: [], execution_successful: false }));
    expect(r.install).toBe(false);
    expect(r.blocking[0].id).toBe("scan-failed");
  });
  it("분석이 불완전하면 통과시키되 알린다", () => {
    const r = scanGate(real({ issues: [], analysis_completeness: { is_complete: false, status: "partial" } }));
    expect(r.install).toBe(true);
    expect(r.incomplete).toBe(true);
    expect(r.warnings.some((x: any) => x.id === "incomplete-analysis")).toBe(true);
  });
  it("이전 findings 형식도 계속 읽는다", () => {
    expect(scanGate({ findings: [{ severity: "critical" }] }).install).toBe(false);
  });
});

describe("skill-audit 문서의 명령이 실제 CLI 와 맞다", () => {
  const t = read("skills/skill-audit/SKILL.md");
  it("skillspector 는 --format json 을 쓰고 없는 --json 을 쓰지 않는다", () => {
    expect(t).toMatch(/skillspector scan [^\n]*--format json/);
    expect(t).not.toMatch(/skillspector scan[^\n]*--json/);
  });
  it("플러그인 전체를 skillevaluator validate --type plugin 으로 본다", () => {
    expect(t).toMatch(/skillevaluator validate [^\n]*--type plugin/);
    expect(t).toMatch(/PYTHONUTF8=1/);
  });
});

// YAML plain scalar 규칙: 따옴표 없는 값 안의 ": " 는 새 매핑으로 읽혀 엄격한 파서가 거부한다.
// Claude Code 는 관대하게 읽지만 SkillEvaluator·npx skills·다른 에이전트는 실패한다.
function frontmatterErrors(file: string): string[] {
  const m = fs.readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return [];
  const errs: string[] = [];
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    if (!v || /^[>|[{]/.test(v)) continue;
    if (v.startsWith('"')) { try { JSON.parse(v); } catch { errs.push(`${kv[1]}: 깨진 큰따옴표 문자열`); } continue; }
    if (v.startsWith("'")) { if (!/^'(?:[^']|'')*'$/.test(v)) errs.push(`${kv[1]}: 깨진 작은따옴표 문자열`); continue; }
    if (/: |\s#/.test(v)) errs.push(`${kv[1]}: 따옴표 없는 값에 ": " 또는 " #"`);
  }
  return errs;
}
const mdFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return ["node_modules", "__pycache__"].includes(e.name) ? [] : mdFiles(p);
  return /\.md$/.test(e.name) ? [p] : [];
});

describe("frontmatter 는 엄격한 YAML 로 읽힌다", () => {
  it("검사기가 실제 오류 모양을 잡는다", () => {
    const tmp = path.join(fs.mkdtempSync(path.join(require("node:os").tmpdir(), "fm-")), "x.md");
    fs.writeFileSync(tmp, "---\nname: x\ndescription: Do it. 트리거: \"가\".\n---\n");
    expect(frontmatterErrors(tmp)).toHaveLength(1);
    fs.writeFileSync(tmp, "---\nname: x\ndescription: \"Do it. 트리거: \\\"가\\\".\"\n---\n");
    expect(frontmatterErrors(tmp)).toEqual([]);
  });
  it("플러그인의 모든 frontmatter 가 통과한다", () => {
    const bad = mdFiles(P).map((f) => [f, frontmatterErrors(f)] as const).filter(([, e]) => e.length);
    expect(bad.map(([f, e]) => `${f}: ${e.join(", ")}`)).toEqual([]);
  });
});

describe("문서 예시에 실제 연락처를 싣지 않는다", () => {
  it("phone 예시 번호는 자리표시자다", () => {
    expect(read("skills/phone/SKILL.md")).not.toMatch(/977-85-2848/);
  });
});
