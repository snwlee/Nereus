import { describe, it, expect } from "vitest";
import { phoneGateVerdict, callSummary } from "../../plugins/nereus/hooks/scripts/lib/phone-gate.mjs";
import { handle, DEFAULT_RULES, askOutput } from "../../plugins/nereus/hooks/scripts/pre-tool-guard.mjs";

// 보안 리뷰 H1(2026-09-26): --approved 는 에이전트가 스스로 붙이는 플래그다. 사람 승인은 Claude Code 권한 창으로 받는다.
const brief = JSON.stringify({ to: "+81977852848", target: "七厘焼き和作", language: "ja", questions: ["11月4日は営業されますか", "19時に4名で予約できますか"] });
const readFile = () => brief;

describe("phone gate", () => {
  it("--approved 발신은 ask 이고 번호·상대·질문을 보여 준다", () => {
    const v = phoneGateVerdict({ command: 'node "$P/call.mjs" --brief b.json --id wasaku-1104 --approved', cwd: "/r", readFile })!;
    expect(v.decision).toBe("ask");
    expect(v.reason).toContain("+81977852848");
    expect(v.reason).toContain("七厘焼き和作");
    expect(v.reason).toContain("19時に4名で予約できますか");
  });

  it("--to 리허설 번호가 있으면 그 번호를 보여 준다", () => {
    const v = phoneGateVerdict({ command: "node call.mjs --brief b.json --id w --to +821012345678 --approved", cwd: "/r", readFile })!;
    expect(v.reason).toContain("+821012345678");
  });

  it("승인 없는 판정 실행·다른 명령은 통과", () => {
    expect(phoneGateVerdict({ command: "node call.mjs --brief b.json --id w", cwd: "/r", readFile })).toBeNull();
    expect(phoneGateVerdict({ command: "node probe.mjs --risk read", cwd: "/r", readFile })).toBeNull();
    expect(phoneGateVerdict({ command: "echo --approved", cwd: "/r", readFile })).toBeNull();
  });

  it("브리프를 못 읽어도 ask 는 유지한다", () => {
    const v = phoneGateVerdict({ command: "node call.mjs --brief nope.json --id w --approved", cwd: "/r", readFile: () => { throw new Error("ENOENT"); } })!;
    expect(v.decision).toBe("ask");
    expect(v.reason).toContain("브리프를 읽지 못했");
  });

  it("callSummary 는 줄바꿈을 접는다", () => {
    expect(callSummary({ to: "+81", target: "a\nb", questions: ["q\n1"] })).not.toContain("\n");
  });

  it("pre-tool-guard 가 ask 를 돌려주고 권한 창 JSON 을 만든다", () => {
    const r = handle({ cwd: "/r", tool_name: "Bash", tool_input: { command: "node call.mjs --brief b.json --id w --approved" } },
      { rules: () => DEFAULT_RULES, staged: () => ({ files: [], diff: "" }), readFile })!;
    expect(r.decision).toBe("ask");
    const out = JSON.parse(askOutput(r.reason));
    expect(out.hookSpecificOutput).toMatchObject({ hookEventName: "PreToolUse", permissionDecision: "ask" });
  });
});
