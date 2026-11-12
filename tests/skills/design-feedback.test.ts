import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { directionPrompt, visualPrompt, parseCritique, feedbackReport, RECORD_SOURCE, promptFor, planRecord, validRefImages } from "../../plugins/nereus/skills/design/scripts/design-feedback.mjs";

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
  it("marks a reply with no items and no OK verdict as not a critique", () => {
    expect(parseCritique("죄송합니다. 이 요청은 도와드릴 수 없습니다.").isCritique).toBe(false);
    expect(parseCritique("VERDICT: REVISE").isCritique).toBe(false);
    expect(parseCritique("").isCritique).toBe(false);
  });
  it("counts an item or a bare OK verdict as a critique", () => {
    expect(parseCritique("VERDICT: OK").isCritique).toBe(true);
    expect(parseCritique("- [LOW] 여백이 좁다\nVERDICT: REVISE").isCritique).toBe(true);
  });
  it("treats a HIGH or CRITICAL item as REVISE even if the verdict says OK", () => {
    const r = parseCritique("- [CRITICAL] 대비 2:1 로 읽을 수 없다\nVERDICT: OK");
    expect(r.verdict).toBe("REVISE");
  });
});

// 2026-11-12 사용자 방침: 디자인 비평은 impeccable 1순위. Gemini 는 무료 이미지 생성에만 쓴다.
describe("디자인 비평 채널은 impeccable", () => {
  it("라운드 출처는 impeccable 이다", () => {
    expect(RECORD_SOURCE).toBe("impeccable");
  });
  it("디자인 스크립트는 Gemini 웹세션·agy 를 부르지 않는다", () => {
    const src = fs.readFileSync("plugins/nereus/skills/design/scripts/design-feedback.mjs", "utf8");
    expect(src).not.toMatch(/gemini_cli/);
    expect(src).not.toMatch(/["']agy["']/);
  });
  it("direction·visual 직접 실행은 impeccable 안내와 함께 종료코드 2", () => {
    for (const phase of ["direction", "visual"]) {
      const r = spawnSync(process.execPath, ["plugins/nereus/skills/design/scripts/design-feedback.mjs", phase], { encoding: "utf8" });
      expect(r.status, phase).toBe(2);
      expect(r.stderr, phase).toMatch(/impeccable/);
    }
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

  it("impeccable 출처로 남긴다 — 나중에 어느 채널이 판정했는지 추적한다", () => {
    const r = planRecord({ phase: "direction", critique: "- [LOW] x\nVERDICT: OK", hashOf });
    expect(r.round.source).toBe("impeccable");
  });
  // EGM 리뷰 [MEDIUM] (2026-11-12): 비평을 옮기는 것이 코드를 쓴 세션이라 자기 신고가 된다.
  // impeccable 원본 보고서의 해시를 라운드에 묶어, 옮긴 내용을 원본과 대조할 수 있게 한다.
  it("원본 보고서를 주면 해시를 라운드에 남긴다", () => {
    const r = planRecord({ phase: "visual", critique: "- [LOW][rhythm] x\nVERDICT: OK", files: ["a.css"], hashOf, report: "# Critique\nP3 spacing", reportPath: ".nereus/design/raw.md" });
    expect(r.round.report).toMatchObject({ path: ".nereus/design/raw.md" });
    expect(r.round.report.hash).toMatch(/^[0-9a-f]{16}$/);
  });
  it("격리가 깨진(DEGRADED) impeccable 보고서는 기록을 거절한다", () => {
    expect(() => planRecord({ phase: "visual", critique: "VERDICT: OK", files: ["a.css"], hashOf, report: "⚠️ DEGRADED: single-context (no subagent)\n..." })).toThrow(/DEGRADED/);
  });
  it("CLI record 는 --report 없이 거절한다", () => {
    const r = spawnSync(process.execPath, ["plugins/nereus/skills/design/scripts/design-feedback.mjs", "record", "direction", "--critique", "VERDICT: OK"], { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--report/);
  });

  it("verdict 를 기존 파서로 읽는다 (fail-closed 유지)", () => {
    expect(planRecord({ phase: "direction", critique: "VERDICT: OK", hashOf }).round.verdict).toBe("OK");
    // VERDICT 줄이 없으면 REVISE — MCP 경로가 게이트를 느슨하게 만들면 안 된다
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

  it("지적도 OK 판정도 없는 응답은 거부한다 — 거절문이 차단 0 으로 기록되면 게이트가 통과한다", () => {
    const refusal = "죄송합니다. 실존 인물의 사진이 포함된 이미지에 대해서는 도와드릴 수 없습니다.";
    expect(() => planRecord({ phase: "visual", critique: refusal, files: ["src/a.css"], hashOf })).toThrow(/비평이 아닙니다/);
    expect(() => planRecord({ phase: "direction", critique: "좋아 보입니다", hashOf })).toThrow(/비평이 아닙니다/);
  });

  it("빈 비평은 거부한다 — 빈 기록은 게이트 우회다", () => {
    expect(() => planRecord({ phase: "visual", critique: "   ", hashOf })).toThrow(/비평/);
    expect(() => planRecord({ phase: "direction", critique: "", hashOf })).toThrow(/비평/);
  });

  it("알 수 없는 phase 는 거부한다", () => {
    expect(() => planRecord({ phase: "nope", critique: "VERDICT: OK", hashOf })).toThrow(/direction|visual/);
  });
});

// ── 축 고정 (2026-09-15) ──────────────────────────────────────────────────────
// 2026-09-13 googleplay-control 에서 같은 두 파일에 visual 라운드가 다섯 번 돌았고
// 전부 REVISE 였다. 라운드마다 요구가 뒤집혔다 - "320px 은 세로 1열로" 다음 라운드가
// "세로 스택이 너무 크다, 인라인으로", "1440px 은 2열로" 다음이 "2열은 높이가 안 맞으니
// 세로로". 비평가는 매번 처음 보는 사람이라 직전에 자기가 시킨 것을 모른다.
//
// 그래서 두 가지를 고친다.
//  (1) 뒤집히지 않는 축만 차단한다 - 접근성·계층·상태. 배치와 표면은 취향이라 권고로 남긴다.
//  (2) 프롬프트에 직전 라운드의 지적을 실어 준다. 되돌리라고 요구하려면 그렇게 말해야 한다.
import { AXES, BLOCKING_AXES, axisOf } from "../../plugins/nereus/skills/design/scripts/design-feedback.mjs";

describe("축", () => {
  it("여덟 축에 키가 있고, 차단 축은 그중 뒤집히지 않는 셋이다", () => {
    expect(Object.keys(AXES)).toEqual(
      expect.arrayContaining(["hierarchy", "rhythm", "depth", "type", "color", "states", "template", "a11y"]),
    );
    expect([...BLOCKING_AXES].sort()).toEqual(["a11y", "hierarchy", "states"]);
  });

  it("지적 줄에서 축 태그를 읽는다. 없으면 null", () => {
    expect(axisOf("- [HIGH][a11y] 대비 2:1")).toBe("a11y");
    expect(axisOf("- [HIGH] 대비 2:1")).toBeNull();
    expect(axisOf("- [HIGH][없는축] x")).toBeNull();
  });
});

describe("parseCritique — 차단은 축으로 가른다", () => {
  it("차단 축의 HIGH 는 차단한다", () => {
    const r = parseCritique("- [HIGH][a11y] 대비가 WCAG AA 미달\nVERDICT: REVISE");
    expect(r.blocking).toHaveLength(1);
    expect(r.verdict).toBe("REVISE");
  });

  it("배치·표면 취향 축은 CRITICAL 이어도 권고로만 남는다 - 여기서 진동이 났다", () => {
    const r = parseCritique(
      "- [CRITICAL][rhythm] 1440px 우측이 빈 공간이다\n- [HIGH][depth] 표면 규칙이 서로 다르다\nVERDICT: REVISE",
    );
    expect(r.blocking).toHaveLength(0);
    expect(r.advisory).toHaveLength(2);
    // verdict 는 그대로 REVISE 다 - 기록에는 남는다. 다만 게이트를 막지 않는다.
    expect(r.verdict).toBe("REVISE");
  });

  it("축을 안 붙인 CRITICAL 은 그대로 차단한다 - 가장 센 지적까지 흘려보내지 않는다", () => {
    expect(parseCritique("- [CRITICAL] 읽을 수 없다\nVERDICT: REVISE").blocking).toHaveLength(1);
  });

  it("축을 안 붙인 HIGH 는 권고다 - 태그를 안 붙인 것으로 사람을 무한히 막지 않는다", () => {
    const r = parseCritique("- [HIGH] 뭔가 아쉽다\nVERDICT: REVISE");
    expect(r.blocking).toHaveLength(0);
    expect(r.untagged).toBe(1);
  });
});

describe("planRecord — 라운드에 차단 개수를 남긴다", () => {
  const hashOf = (files: string[]) => Object.fromEntries(files.map((f) => [f, "h:" + f]));
  it("게이트가 verdict 가 아니라 이 숫자를 본다", () => {
    const r = planRecord({
      phase: "visual",
      critique: "- [CRITICAL][rhythm] 빈 공간\nVERDICT: REVISE",
      files: ["a.css"],
      hashOf,
    });
    expect(r.round.blocking).toBe(0);
    expect(r.round.verdict).toBe("REVISE");
  });
});

describe("visualPrompt — 직전 라운드를 기억시킨다", () => {
  it("직전 지적을 싣고, 되돌리려면 그렇게 말하라고 요구한다", () => {
    const p = visualPrompt({
      shots: [{ path: "s.png", width: 320 }],
      previous: "[CRITICAL][rhythm] 320px 에서 3열은 답답하다 - 세로 1열로 바꿀 것",
    });
    expect(p).toContain("320px 에서 3열은 답답하다");
    expect(p).toMatch(/되돌리|철회|REVERSAL/);
  });
  it("직전 라운드가 없으면 그 절을 넣지 않는다", () => {
    expect(visualPrompt({ shots: [{ path: "s.png", width: 320 }] })).not.toMatch(/직전 라운드/);
  });
  it("축 태그를 출력 형식으로 요구한다", () => {
    const p = visualPrompt({ shots: [{ path: "s.png", width: 320 }] });
    expect(p).toContain("[a11y]");
  });
});

describe("design-motion.refs", () => {
  it("프롬프트에 첨부 레퍼런스와 대조 항목", () => {
    const p = directionPrompt({ brief: "b", refImages: ["/x/stripe-hero.png"] });
    expect(p).toContain("첨부 레퍼런스");
    expect(p).toContain("stripe-hero.png");
    expect(p).toMatch(/가져오고.*버리/);
    expect(directionPrompt({ brief: "b" })).not.toContain("첨부 레퍼런스");
  });
  it("형식·존재 검사", () => {
    const r = validRefImages(["a.png", "b.gif", "c.webp"], (p: string) => p !== "c.webp");
    expect(r.ok).toEqual(["a.png"]);
    expect(r.rejected.map((x) => x.path)).toEqual(["b.gif", "c.webp"]);
  });
});
