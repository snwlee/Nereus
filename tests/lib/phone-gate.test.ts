import { describe, it, expect } from "vitest";
import { handle, DEFAULT_RULES } from "../../plugins/nereus/hooks/scripts/pre-tool-guard.mjs";

// 발신 승인은 대화에서 말로 받는다(2026-11-04 사용자 교정) — 훅은 call.mjs 실행을 막지 않는다.
// 승인 없이 부르면 call.mjs 가 ask 를 내고 걸지 않는다.
const deps = { rules: () => DEFAULT_RULES, staged: () => ({ files: [], diff: "" }) };
const bash = (command: string) => ({ cwd: "/r", tool_name: "Bash", tool_input: { command } });

describe("phone approval gate", () => {
  it("call.mjs 판정·발신 실행 자체는 막지 않는다", () => {
    expect(handle(bash("node call.mjs --brief b.json --id w"), deps)).toBeNull();
    expect(handle(bash("node call.mjs --brief b.json --id w --approved"), deps)).toBeNull();
  });
});
