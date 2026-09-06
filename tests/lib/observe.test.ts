import { describe, it, expect } from "vitest";
import { redact, toolObservation, promptObservation, rotate } from "../../plugins/nereus/hooks/scripts/lib/observe.mjs";
import { detectSignals, mergeCandidates, nextId } from "../../plugins/nereus/hooks/scripts/lib/signals.mjs";

describe("observe — 관찰(판정하지 않음)", () => {
  it("시크릿을 지운다", () => {
    expect(redact("export K=sk-abcdefghijklmnopqrstuvwxyz012345")).toContain("[REDACTED]");
    expect(redact("AKIAABCDEFGHIJKLMNOP 로 접속")).toContain("[REDACTED]");
    expect(redact("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")).toContain("[REDACTED]");
    expect(redact("npm test")).toBe("npm test");
  });
  it("Bash 는 명령 머리를, 편집은 파일 경로를 남긴다", () => {
    const b = toolObservation({ session_id: "s", cwd: "/r", tool_name: "Bash", tool_input: { command: "npm test -- --watch" }, tool_response: { exit_code: 1 } }, { now: 5 })!;
    expect(b).toMatchObject({ k: "tool", tool: "Bash", ok: false, sig: "npm test -- --watch", t: 5 });
    const e = toolObservation({ session_id: "s", cwd: "/r", tool_name: "Edit", tool_input: { file_path: "/r/src/a.ts" } })!;
    expect(e).toMatchObject({ k: "tool", tool: "Edit", file: "src/a.ts", ok: true });
  });
  it("자기 상태 파일과 메모리 플러그인 편집은 관찰하지 않는다", () => {
    expect(toolObservation({ cwd: "/r", tool_name: "Edit", tool_input: { file_path: "/r/.nereus/handoff.md" } })).toBeNull();
    expect(toolObservation({ cwd: "/r", tool_name: "Write", tool_input: { file_path: "/r/.claude-mem/x.json" } })).toBeNull();
    expect(toolObservation({ cwd: "/r", tool_name: "Read", tool_input: { file_path: "/r/src/a.ts" } })).toBeNull();
  });
  it("교정 프롬프트만, 그것도 잘라서 남긴다", () => {
    const c = promptObservation({ session_id: "s", cwd: "/r", prompt: "아니 그게 아니라 " + "가".repeat(500) }, { now: 7 })!;
    expect(c.k).toBe("correction");
    expect(c.excerpt.length).toBeLessThanOrEqual(200);
    expect(promptObservation({ prompt: "테스트 돌려줘" })).toBeNull();
  });
  it("오래된 줄부터 버려 파일 크기를 제한한다", () => {
    const lines = Array.from({ length: 10 }, (_, i) => JSON.stringify({ t: i }));
    expect(rotate(lines.join("\n"), 3).split("\n")).toHaveLength(3);
    expect(rotate(lines.join("\n"), 3)).toContain('"t":9');
    expect(rotate(lines.join("\n"), 3)).not.toContain('"t":0');
  });
});

describe("signals — 결정론 판정(LLM 없음)", () => {
  const obs = (o: any) => ({ k: "tool", tool: "Bash", ok: true, t: 1, s: "sess", ...o });

  it("같은 명령이 실패했다가 성공하면 후보를 만든다", () => {
    const c = detectSignals([obs({ sig: "npm test", ok: false, t: 1 }), obs({ k: "tool", tool: "Edit", file: "src/a.ts", t: 2 }), obs({ sig: "npm test", ok: true, t: 3 })]);
    const fix = c.find((x: any) => x.type === "fail_then_fix")!;
    expect(fix.key).toContain("npm test");
    expect(fix.evidence.join(" ")).toContain("src/a.ts");
  });
  it("세션에서 3회 이상 반복된 명령을 후보로 올린다", () => {
    const c = detectSignals([obs({ sig: "npx vitest run" }), obs({ sig: "npx vitest run" }), obs({ sig: "npx vitest run" })]);
    expect(c.some((x: any) => x.type === "repeated_command" && x.key.includes("npx vitest run"))).toBe(true);
    expect(detectSignals([obs({ sig: "ls" }), obs({ sig: "ls" })]).some((x: any) => x.type === "repeated_command")).toBe(false);
  });
  it("교정 직후 편집이 있으면 후보를 만든다", () => {
    const c = detectSignals([
      { k: "correction", excerpt: "아니 vitest 말고 jest 써", t: 10, s: "sess" },
      obs({ k: "tool", tool: "Edit", file: "vitest.config.ts", t: 11 }),
    ]);
    const corr = c.find((x: any) => x.type === "correction")!;
    expect(corr.evidence.join(" ")).toContain("vitest.config.ts");
    expect(corr.key).toContain("jest");
  });
  it("빈 관찰이면 후보도 없다", () => {
    expect(detectSignals([])).toEqual([]);
  });
});

describe("candidates — 병합과 승인 대기", () => {
  it("같은 key 는 hits 를 올리고 근거를 합친다", () => {
    const a = [{ id: "0001", type: "correction", key: "k", status: "open", hits: 1, evidence: ["e1"], at: 1 }];
    const merged = mergeCandidates(a, [{ type: "correction", key: "k", evidence: ["e2"] }], { now: 9 });
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ hits: 2, at: 9 });
    expect(merged[0].evidence).toEqual(["e1", "e2"]);
    expect(a[0].hits).toBe(1);
  });
  it("declined 후보는 다시 올라오지 않는다", () => {
    const a = [{ id: "0001", type: "correction", key: "k", status: "declined", hits: 1, evidence: [], at: 1 }];
    const merged = mergeCandidates(a, [{ type: "correction", key: "k", evidence: ["e"] }]);
    expect(merged[0].status).toBe("declined");
    expect(merged[0].hits).toBe(1);
  });
  it("새 후보에는 순번 id 를 준다", () => {
    expect(nextId([])).toBe("0001");
    expect(nextId([{ id: "0007" }])).toBe("0008");
    const merged = mergeCandidates([], [{ type: "repeated_command", key: "x", evidence: [] }]);
    expect(merged[0]).toMatchObject({ id: "0001", status: "open", hits: 1 });
  });
  it("근거는 상한을 둔다", () => {
    const many = Array.from({ length: 20 }, (_, i) => `e${i}`);
    const merged = mergeCandidates([], [{ type: "correction", key: "k", evidence: many }]);
    expect(merged[0].evidence.length).toBeLessThanOrEqual(5);
  });
});
