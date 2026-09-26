import { describe, it, expect } from "vitest";
import { handle, DEFAULT_RULES } from "../../plugins/nereus/hooks/scripts/pre-tool-guard.mjs";

// 보안 리뷰 R2(2026-09-26): 발신 승인은 사람이 `!` 로 직접 실행한 approve.mjs 만 만든다.
// `!` 명령은 에이전트 도구 훅을 거치지 않는다 — 에이전트가 approve.mjs 를 부르거나 승인 폴더를 쓰면 막는다.
const deps = { rules: () => DEFAULT_RULES, staged: () => ({ files: [], diff: "" }) };
const bash = (command: string) => ({ cwd: "/r", tool_name: "Bash", tool_input: { command } });

describe("phone approval gate", () => {
  it("에이전트가 approve.mjs 를 실행하면 block", () => {
    for (const c of ['node "$P/approve.mjs" wasaku-1104', "cd x && node ./approve.mjs w", "sh -c 'node approve.mjs w'"])
      expect(handle(bash(c), deps)!.decision).toBe("block");
  });

  it("에이전트가 승인 폴더를 쓰거나 만지면 block", () => {
    expect(handle({ cwd: "/r", tool_name: "Write", tool_input: { file_path: "/Users/u/.local/share/nereus/phone/approvals/w.json" } }, deps)!.decision).toBe("block");
    expect(handle(bash("echo {} > ~/.local/share/nereus/phone/approvals/w.json"), deps)!.decision).toBe("block");
  });

  it("call.mjs 판정·발신 실행 자체는 막지 않는다 — 승인 파일이 없으면 call.mjs 가 걸지 않는다", () => {
    expect(handle(bash("node call.mjs --brief b.json --id w"), deps)).toBeNull();
    expect(handle(bash("node call.mjs --brief b.json --id w --approved"), deps)).toBeNull();
  });
});
