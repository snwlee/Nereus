import { describe, it, expect } from "vitest";
import { handle, parseSeen } from "../../plugins/nereus/hooks/scripts/skill-router.mjs";

const deps = (seen: string[] = []) => {
  let store = seen.join("\n");
  return {
    readSeen: () => store,
    writeSeen: (s: string) => { store = s; },
    peek: () => store,
  };
};

describe("skill-router 훅", () => {
  it("매칭되면 UserPromptSubmit 컨텍스트로 안내를 주입한다", () => {
    const out = handle({ cwd: "/r", session_id: "s1", prompt: "로그인하면 에러가 나" }, deps())!;
    expect(out.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(out.hookSpecificOutput.additionalContext).toContain("nereus:debug");
  });
  it("매칭이 없으면 아무것도 주입하지 않는다", () => {
    expect(handle({ cwd: "/r", session_id: "s1", prompt: "고마워" }, deps())).toBeNull();
  });
  it("같은 스킬을 같은 세션에서 두 번 지목하지 않는다", () => {
    const d = deps();
    expect(handle({ cwd: "/r", session_id: "s1", prompt: "에러가 나" }, d)).not.toBeNull();
    expect(handle({ cwd: "/r", session_id: "s1", prompt: "또 에러가 나" }, d)).toBeNull();
    expect(d.peek()).toContain("nereus:debug");
  });
  it("다른 스킬은 여전히 지목한다", () => {
    const d = deps(["nereus:debug"]);
    const out = handle({ cwd: "/r", session_id: "s1", prompt: "이 화면 예쁘게 해줘" }, d)!;
    expect(out.hookSpecificOutput.additionalContext).toContain("nereus:design");
  });
  it("빈 프롬프트·프롬프트 없음에도 죽지 않는다", () => {
    expect(handle({ cwd: "/r", session_id: "s1" }, deps())).toBeNull();
    expect(handle({ cwd: "/r", session_id: "s1", prompt: "" }, deps())).toBeNull();
  });
});

describe("parseSeen", () => {
  it("빈 파일과 없는 파일을 빈 배열로 읽는다", () => {
    expect(parseSeen("")).toEqual([]);
    expect(parseSeen(null)).toEqual([]);
  });
  it("줄 단위로 읽고 공백을 버린다", () => {
    expect(parseSeen("nereus:debug\n\nnereus:design\n")).toEqual(["nereus:debug", "nereus:design"]);
  });
});
