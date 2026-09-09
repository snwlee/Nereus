import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  RULES,
  auditText,
  auditFiles,
  formatReport,
  exitCodeFor,
} from "../../plugins/nereus/skills/skill-audit/scripts/prompt-audit.mjs";

describe("RULES", () => {
  it("declares only patterns Anthropic named as frontier-model anti-patterns", () => {
    const ids = RULES.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["thoroughness-booster", "verification-ritual", "scratchpad-scaffolding", "dated-model"]));
    for (const r of RULES) {
      expect(r.why).toMatch(/\S/);
      expect(r.re).toBeInstanceOf(RegExp);
      // 전역 플래그는 lastIndex 상태를 남겨 재사용 시 결과가 흔들린다
      expect(r.re.global).toBe(false);
    }
  });
});

describe("auditText — 실제 anti-pattern 만 잡는다", () => {
  it("flags pure thoroughness boosters", () => {
    for (const s of ["코드를 꼼꼼히 검토한다", "철저히 확인할 것", "빠짐없이 훑는다", "be maximally thorough"]) {
      expect(auditText(s).map((f) => f.id)).toContain("thoroughness-booster");
    }
  });

  it("flags verification rituals", () => {
    for (const s of ["다시 한 번 확인한다", "두 번 확인하세요", "double-check your work", "verify twice"]) {
      expect(auditText(s).map((f) => f.id)).toContain("verification-ritual");
    }
  });

  it("flags scratchpad scaffolding", () => {
    expect(auditText("단계별로 생각한 뒤 답한다").map((f) => f.id)).toContain("scratchpad-scaffolding");
    expect(auditText("Let's think step by step.").map((f) => f.id)).toContain("scratchpad-scaffolding");
  });

  it("flags dated model identifiers", () => {
    expect(auditText("model: claude-3-opus-20240229").map((f) => f.id)).toContain("dated-model");
    expect(auditText("gpt-4-turbo 를 쓴다").map((f) => f.id)).toContain("dated-model");
    expect(auditText("claude-opus-5 를 쓴다")).toEqual([]);
  });

  it("does NOT flag gate rules — the load-bearing kind we actually enforce", () => {
    // 이것들이 거짓양성으로 잡히면 검사가 무의미해진다. 우리 SKILL.md 의 실제 문장이다.
    const gateRules = [
      "코드를 한 줄이라도 더 고쳤으면 evidence는 STALE이 된다. 마지막 편집 뒤에 반드시 한 번 더 돌린다.",
      "수정 전에 반드시 있어야 한다. tdd.enforce 가 block 이면 PreToolUse 가 실제로 막는다.",
      "디자인·UI·UX·미감 작업은 Gemini 피드백을 반드시 거친다.",
      "설치 전에 반드시 돌린다. 심각한 지적이 하나라도 있으면 설치하지 말고 보고한다.",
      "CRITICAL/HIGH 가 0 이어야 통과한다.",
      "절대 경로로 import 하면 컴파일이 거부된다.",
    ];
    for (const s of gateRules) expect(auditText(s)).toEqual([]);
  });

  it("reports line numbers so the fix is findable", () => {
    const f = auditText("첫 줄\n꼼꼼히 본다\n셋째 줄");
    expect(f[0]).toMatchObject({ line: 2 });
    expect(f[0].text).toContain("꼼꼼히");
  });

  it("ignores fenced code blocks — a shell example is not a prompt instruction", () => {
    const text = ["설명", "```bash", "echo '꼼꼼히'", "```", "본문"].join("\n");
    expect(auditText(text)).toEqual([]);
  });

  it("ignores inline code spans", () => {
    expect(auditText("`double-check` 라는 플래그 이름")).toEqual([]);
  });
});

describe("auditFiles", () => {
  it("aggregates per file and keeps clean files out of the report", () => {
    const read = (p: string) => (p === "a.md" ? "꼼꼼히 본다" : "게이트를 통과해야 한다");
    const r = auditFiles(["a.md", "b.md"], { readFile: read });
    expect(r.map((x) => x.file)).toEqual(["a.md"]);
    expect(r[0].findings).toHaveLength(1);
  });

  it("survives an unreadable file instead of aborting the whole audit", () => {
    const read = (p: string) => { if (p === "bad.md") throw new Error("ENOENT"); return "꼼꼼히"; };
    const r = auditFiles(["bad.md", "ok.md"], { readFile: read });
    expect(r.map((x) => x.file)).toEqual(["ok.md"]);
  });
});

describe("formatReport / exitCodeFor", () => {
  it("says it is clean when nothing was found", () => {
    const s = formatReport([], 32);
    expect(s).toMatch(/32/);
    expect(s).toMatch(/없|clean|0건/);
    expect(exitCodeFor([])).toBe(0);
  });

  it("names file, line and reason so the fix is actionable", () => {
    const rep = [{ file: "skills/x/SKILL.md", findings: [{ id: "thoroughness-booster", line: 7, text: "꼼꼼히 본다", why: "프론티어 모델에는 효과가 없고 토큰만 쓴다" }] }];
    const s = formatReport(rep, 32);
    expect(s).toContain("skills/x/SKILL.md");
    expect(s).toContain("7");
    expect(s).toContain("thoroughness-booster");
    expect(s).toMatch(/토큰/);
    expect(exitCodeFor(rep)).toBe(1);
  });
});

// 회귀 게이트: 이 저장소의 프롬프트가 anti-pattern 0건인 상태를 고정한다.
// 2026-09-10 실측에서 0건이었고, 앞으로 누가 "꼼꼼히 검토한다" 를 넣으면 여기서 깨진다.
// CI 의 skill-quality 잡은 continue-on-error 라 게이트가 되지 못하므로 테스트로 둔다.
describe("이 저장소의 프롬프트 (회귀 게이트)", () => {
  const root = path.resolve(__dirname, "..", "..");
  const targets = [
    ...fs.readdirSync(path.join(root, "plugins/nereus/skills"))
      .map((d) => path.join(root, "plugins/nereus/skills", d, "SKILL.md"))
      .filter((f) => fs.existsSync(f)),
    ...fs.readdirSync(path.join(root, "plugins/nereus/agents"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(root, "plugins/nereus/agents", f)),
  ];

  it("검사 대상이 실제로 잡힌다 (glob 이 비면 테스트가 무의미해진다)", () => {
    expect(targets.length).toBeGreaterThan(20);
  });

  it("스킬·에이전트 프롬프트에 anti-pattern 이 없다", () => {
    const report = auditFiles(targets).map((r) => ({ ...r, file: path.relative(root, r.file) }));
    expect(formatReport(report, targets.length)).toContain("지적 0건");
  });
});
