import { describe, it, expect } from "vitest";
import {
  handlePreTool, handleStop, fingerprint, looksLikeHandoff, lastAssistantText, HUMAN_LAST_POLICY,
} from "../../plugins/nereus/hooks/scripts/human-gate.mjs";

const ask = (q = "도메인 사 주실래요?") => ({
  hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", session_id: "s1", cwd: "/r",
  tool_input: { questions: [{ question: q, header: "h", options: [], multiSelect: false }] },
});
const memStore = () => { let seen: string[] = []; return { load: () => seen, save: (v: string[]) => { seen = v; } }; };

describe("human-gate PreToolUse(AskUserQuestion)", () => {
  it("처음 보는 질문은 한 번 되돌리고 점검 목록을 준다", () => {
    const out = handlePreTool(ask(), memStore())!;
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain("AI");
  });
  it("같은 질문을 다시 부르면 통과시킨다", () => {
    const s = memStore();
    handlePreTool(ask(), s);
    expect(handlePreTool(ask(), s)).toBeNull();
  });
  it("질문이 바뀌면 다시 한 번 되돌린다", () => {
    const s = memStore();
    handlePreTool(ask("A?"), s);
    expect(handlePreTool(ask("B?"), s)).not.toBeNull();
  });
  it("다른 도구는 건드리지 않는다", () => {
    expect(handlePreTool({ ...ask(), tool_name: "Bash" }, memStore())).toBeNull();
  });
  it("지문은 질문 문구로만 정해진다", () => {
    expect(fingerprint(ask("X").tool_input)).toBe(fingerprint(ask("X").tool_input));
    expect(fingerprint(ask("X").tool_input)).not.toBe(fingerprint(ask("Y").tool_input));
  });
});

describe("human-gate Stop", () => {
  it("사람에게 일을 넘기며 멈추면 한 번 막는다", () => {
    const out = handleStop({ last_assistant_message: "도메인을 구매해 주시면 이어서 진행하겠습니다." })!;
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("사람 개입");
  });
  it("stop_hook_active 면 절대 막지 않는다", () => {
    expect(handleStop({ stop_hook_active: true, last_assistant_message: "API 키를 발급해 주세요." })).toBeNull();
  });
  it("일반 완료 보고는 통과시킨다", () => {
    expect(handleStop({ last_assistant_message: "구현과 테스트를 마쳤고 푸시했습니다." })).toBeNull();
  });
  it("last_assistant_message 가 없으면 transcript 끝의 assistant 텍스트를 읽는다", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" } }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "로그인해 주세요." }] } }),
    ].join("\n");
    expect(lastAssistantText({ transcript_path: "/t" }, () => lines)).toBe("로그인해 주세요.");
    expect(handleStop({ transcript_path: "/t" }, { readFile: () => lines })).not.toBeNull();
  });
});

describe("handoff 판정", () => {
  it.each([
    "도메인 구매가 필요합니다. 구매해 주세요.",
    "Play Console 에 로그인해 주세요",
    "API 키를 발급해 주시면 됩니다",
    "결제 승인이 필요합니다",
    "Please purchase the domain and let me know.",
  ])("넘김: %s", (t) => expect(looksLikeHandoff(t)).toBe(true));
  it.each([
    "구매 흐름 E2E 를 추가했습니다.",
    "로그인 화면을 구현했습니다.",
    "",
  ])("넘김 아님: %s", (t) => expect(looksLikeHandoff(t)).toBe(false));
});

it("정책 문구가 최후순위·선완료·AI 우선을 모두 말한다", () => {
  expect(HUMAN_LAST_POLICY).toMatch(/최후순위/);
  expect(HUMAN_LAST_POLICY).toMatch(/나머지/);
  expect(HUMAN_LAST_POLICY).toMatch(/AI/);
});
