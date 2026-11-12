import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  SECURITY_REFUTER_PERSONA, refutationTargets, applyRefutations, severityAction, gate, mergeFindings,
} from "../../plugins/nereus/skills/review/scripts/review.mjs";

// 2026-11-12: cloudflare/security-audit-skill(MIT)의 판정 규칙을 security 에이전트로 옮겼다.
// 가져온 것: 심각도 기준표, "경계+결과" 증명 요건, needs_validation 판정, 발견자가 아닌 새 맥락의 반증 검증.
// 6단계 전체 감사(커버리지 원장·검증기·샌드박스 승격)는 동반 스킬로 안내만 한다.

const P = "plugins/nereus";
const read = (f: string) => fs.readFileSync(`${P}/${f}`, "utf8");

const f = (o: Partial<{ source: string; file: string; line: number; severity: string; message: string }>) =>
  ({ source: "security", file: "src/a.ts", line: 1, severity: "HIGH", message: "m", ...o });

describe("반증 검증 대상", () => {
  it("security 출처의 CRITICAL/HIGH 만 고른다", () => {
    const all = [f({}), f({ severity: "CRITICAL", line: 2 }), f({ severity: "MEDIUM", line: 3 }), f({ source: "ocr", line: 4 })];
    expect(refutationTargets(all).map((x: any) => x.line)).toEqual([1, 2]);
  });
});

describe("반증 결과 적용", () => {
  const base = [f({ line: 1 }), f({ line: 2 }), f({ line: 3 }), f({ line: 4 })];
  const verdicts = [
    { file: "src/a.ts", line: 1, verdict: "confirmed" },
    { file: "src/a.ts", line: 2, verdict: "rejected", reason: "상위 미들웨어가 막는다" },
    { file: "src/a.ts", line: 3, verdict: "needs_validation", missing: "프록시가 X-Forwarded-For 를 덮어쓰는지" },
  ];

  it("confirmed 는 그대로, rejected 는 빼서 따로, needs_validation 은 심각도를 뗀다", () => {
    const r = applyRefutations(base, verdicts);
    expect(r.findings.map((x: any) => [x.line, x.severity])).toEqual([[1, "HIGH"], [3, "NEEDS_VALIDATION"], [4, "HIGH"]]);
    expect(r.findings.find((x: any) => x.line === 3).message).toMatch(/프록시가 X-Forwarded-For/);
    expect(r.rejected.map((x: any) => x.line)).toEqual([2]);
    expect(r.rejected[0].reason).toMatch(/상위 미들웨어/);
  });
  it("판정이 없는 항목은 차단을 유지한다(조용히 풀지 않는다)", () => {
    const r = applyRefutations(base, []);
    expect(gate(r.findings).blocking).toBe(4);
  });
  it("confirmed 의 심각도는 내려갈 수만 있고 올라가지 않는다", () => {
    const down = applyRefutations([f({})], [{ file: "src/a.ts", line: 1, verdict: "confirmed", severity: "MEDIUM" }]);
    expect(down.findings[0].severity).toBe("MEDIUM");
    const up = applyRefutations([f({})], [{ file: "src/a.ts", line: 1, verdict: "confirmed", severity: "CRITICAL" }]);
    expect(up.findings[0].severity).toBe("HIGH");
    const junk = applyRefutations([f({})], [{ file: "src/a.ts", line: 1, verdict: "confirmed", severity: "whatever" }]);
    expect(junk.findings[0].severity).toBe("HIGH");
  });
  it("모르는 판정은 차단을 유지한다", () => {
    const r = applyRefutations([f({})], [{ file: "src/a.ts", line: 1, verdict: "maybe" }]);
    expect(r.findings[0].severity).toBe("HIGH");
  });
  it("입력을 바꾸지 않는다", () => {
    const copy = JSON.parse(JSON.stringify(base));
    applyRefutations(base, verdicts);
    expect(base).toEqual(copy);
  });
  it("needs_validation 은 게이트를 막지 않고 ledger 로 간다", () => {
    const r = applyRefutations(base, verdicts);
    expect(gate(r.findings).blocking).toBe(2);
    expect(severityAction("NEEDS_VALIDATION")).toBe("defer-ledger");
    expect(mergeFindings(r.findings)).toMatch(/### NEEDS_VALIDATION/);
  });
});

describe("반증 페르소나와 문서", () => {
  it("반증 페르소나가 있고 세 판정과 출처를 적는다", () => {
    const t = fs.readFileSync(SECURITY_REFUTER_PERSONA, "utf8");
    for (const v of ["confirmed", "rejected", "needs_validation"]) expect(t).toMatch(new RegExp(v));
    expect(t).toMatch(/cloudflare\/security-audit-skill/);
  });
  it("security 에이전트가 심각도 기준·경계 요건·needs_validation 을 적는다", () => {
    const t = read("agents/security.md");
    for (const s of ["critical", "high", "medium", "low", "needs_validation", "강화 권고", "완전히"]) expect(t).toMatch(new RegExp(s));
    expect(t).toMatch(/경계/);
    expect(t).toMatch(/cloudflare\/security-audit-skill/);
  });
  it("도메인 참고 문서를 출처와 함께 싣는다", () => {
    for (const r of ["ai-and-llm.md", "supply-chain-and-release.md"]) {
      const t = read(`skills/review/references/security/${r}`);
      expect(t).toMatch(/cloudflare\/security-audit-skill/);
      expect(t).toMatch(/MIT/);
      expect(read("agents/security.md")).toMatch(new RegExp(r.replace(/\./g, "\\.")));
    }
  });
  it("review 스킬이 반증 단계를 안내한다", () => {
    const t = read("skills/review/SKILL.md");
    expect(t).toMatch(/securityRefuter/);
    expect(t).toMatch(/반증/);
  });
  it("setup 이 전체 감사용 동반 스킬 설치를 안내한다", () => {
    expect(read("skills/setup/SKILL.md")).toMatch(/npx skills add https:\/\/github\.com\/cloudflare\/security-audit-skill/);
  });
});
