import { describe, it, expect } from "vitest";
import { directionPrompt, visualPrompt, parseCritique, planRunner, feedbackReport, MCP_SOURCE, promptFor, planRecord } from "../../plugins/nereus/skills/design/scripts/design-feedback.mjs";

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

describe("promptFor — MCP 로 내보낼 프롬프트", () => {
  it("phase 에 맞는 프롬프트를 그대로 돌려준다", () => {
    const d = promptFor({ phase: "direction", brief: "결제 히어로. 라이트 럭셔리." });
    expect(d).toBe(directionPrompt({ brief: "결제 히어로. 라이트 럭셔리.", target: "web", refs: "" }));

    const v = promptFor({ phase: "visual", shots: [{ path: "s.png", width: 320 }], context: "히어로" });
    expect(v).toBe(visualPrompt({ shots: [{ path: "s.png", width: 320 }], context: "히어로" }));
  });

  it("알 수 없는 phase 는 거부한다", () => {
    expect(() => promptFor({ phase: "nope" })).toThrow(/direction|visual/);
  });

  it("visual 은 스크린샷이 없으면 거부한다 — 첨부 없는 미감 비평은 성립하지 않는다", () => {
    expect(() => promptFor({ phase: "visual", shots: [] })).toThrow(/스크린샷/);
  });
});

describe("planRecord — MCP 응답을 라운드로", () => {
  const hashOf = (files: string[]) => Object.fromEntries(files.map((f) => [f, "h:" + f]));

  it("MCP 채널을 별도 source 로 남긴다 — 나중에 어느 채널이 판정했는지 추적한다", () => {
    const r = planRecord({ phase: "direction", critique: "- [LOW] x\nVERDICT: OK", hashOf });
    expect(r.round.source).toBe(MCP_SOURCE);
    expect(MCP_SOURCE).toMatch(/mcp/);
  });

  it("verdict 를 기존 파서로 읽는다 (fail-closed 유지)", () => {
    expect(planRecord({ phase: "direction", critique: "VERDICT: OK", hashOf }).round.verdict).toBe("OK");
    // VERDICT 줄이 없으면 REVISE — MCP 경로가 게이트를 느슨하게 만들면 안 된다
    expect(planRecord({ phase: "direction", critique: "좋아 보입니다", hashOf }).round.verdict).toBe("REVISE");
    expect(planRecord({ phase: "direction", critique: "- [HIGH] 대비 부족\nVERDICT: OK", hashOf }).round.verdict).toBe("REVISE");
  });

  it("visual 은 --files 를 해시로 바꿔 커버 대상을 남긴다", () => {
    const r = planRecord({ phase: "visual", critique: "VERDICT: OK", files: ["src/a.css", " src/b.tsx "], hashOf });
    expect(Object.keys(r.round.files)).toEqual(["src/a.css", "src/b.tsx"]);
    expect(r.round.phase).toBe("visual");
  });

  it("direction 라운드는 파일을 커버하지 않는다", () => {
    expect(planRecord({ phase: "direction", critique: "VERDICT: OK", files: ["src/a.css"], hashOf }).round.files).toEqual({});
  });

  it("visual 에 파일이 없으면 경고를 붙인다 — 게이트가 계속 차단하기 때문", () => {
    const r = planRecord({ phase: "visual", critique: "VERDICT: OK", files: [], hashOf });
    expect(r.warning).toMatch(/files|커버/i);
  });

  it("빈 비평은 거부한다 — 빈 기록은 게이트 우회다", () => {
    expect(() => planRecord({ phase: "visual", critique: "   ", hashOf })).toThrow(/비평/);
    expect(() => planRecord({ phase: "direction", critique: "", hashOf })).toThrow(/비평/);
  });

  it("알 수 없는 phase 는 거부한다", () => {
    expect(() => planRecord({ phase: "nope", critique: "VERDICT: OK", hashOf })).toThrow(/direction|visual/);
  });
});
