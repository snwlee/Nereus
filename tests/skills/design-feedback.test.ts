import { describe, it, expect } from "vitest";
import { directionPrompt, visualPrompt, parseCritique, planRunner, feedbackReport } from "../../plugins/nereus/skills/design/scripts/design-feedback.mjs";

describe("prompts", () => {
  it("direction prompt carries the brief and demands a verdict line", () => {
    const p = directionPrompt({ brief: "결제 완료 화면. 신뢰감 있는 라이트 럭셔리.", target: "web" });
    expect(p).toContain("결제 완료 화면");
    expect(p).toContain("VERDICT:");
    expect(p).toMatch(/레퍼런스|팔레트|타이포/);
  });
  it("visual prompt names each attached width so Gemini maps shot to breakpoint", () => {
    const p = visualPrompt({ shots: [{ path: "s320.png", width: 320 }, { path: "s1440.png", width: 1440 }], context: "히어로" });
    expect(p).toContain("320");
    expect(p).toContain("1440");
    expect(p).toContain("히어로");
    expect(p).toMatch(/템플릿/);
    expect(p).toContain("VERDICT:");
  });
});

describe("parseCritique", () => {
  it("reads an OK verdict and the listed items", () => {
    const r = parseCritique(`
- [MEDIUM] 카드 라운드가 균일해 리듬이 없다
- [LOW] 캡션 대비가 낮다
VERDICT: OK
`);
    expect(r.verdict).toBe("OK");
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ severity: "MEDIUM" });
  });
  it("reads a REVISE verdict and keeps the blocking items in the summary", () => {
    const r = parseCritique("- [HIGH] 계층이 없다: 모든 텍스트가 같은 크기\nVERDICT: REVISE");
    expect(r.verdict).toBe("REVISE");
    expect(r.summary).toContain("계층이 없다");
  });
  it("fails closed to REVISE when Gemini returned no verdict line", () => {
    expect(parseCritique("잘 모르겠습니다").verdict).toBe("REVISE");
    expect(parseCritique("").verdict).toBe("REVISE");
  });
  it("treats a HIGH or CRITICAL item as REVISE even if the verdict says OK", () => {
    const r = parseCritique("- [CRITICAL] 대비 2:1 로 읽을 수 없다\nVERDICT: OK");
    expect(r.verdict).toBe("REVISE");
  });
});

describe("planRunner", () => {
  it("uses agy for a text-only direction round", () => {
    const p = planRunner({ phase: "direction", has: (b: string) => b === "agy" });
    expect(p.bin).toBe("agy");
    expect(p.args).toContain("-p");
  });
  it("uses the gemini image CLI for a visual round because screenshots must be attached", () => {
    const p = planRunner({ phase: "visual", shots: [{ path: "a.png", width: 320 }], promptFile: "/tmp/p.txt", has: () => true });
    expect(p.bin).toBe("python3");
    expect(p.args).toEqual(expect.arrayContaining(["ask", "--prompt-file", "/tmp/p.txt", "--file", "a.png"]));
  });
  it("errors instead of silently passing when no gemini channel exists", () => {
    const p = planRunner({ phase: "direction", has: () => false });
    expect(p.error).toMatch(/agy/);
    expect(p.bin).toBeUndefined();
  });
  it("refuses a visual round with no screenshots", () => {
    expect(planRunner({ phase: "visual", shots: [], has: () => true }).error).toMatch(/스크린샷/);
  });
});

describe("feedbackReport", () => {
  it("renders the gate result as markdown with the blocking verdict", () => {
    const md = feedbackReport({ pass: false, findings: [{ category: "design_feedback_missing", file: "a.css", message: "없음" }] });
    expect(md).toContain("a.css");
    expect(md).toContain("차단");
  });
  it("says 통과 when nothing is outstanding", () => {
    expect(feedbackReport({ pass: true, findings: [] })).toContain("통과");
  });
});
