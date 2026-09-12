import { describe, it, expect } from "vitest";
import { ndaGuard } from "../../plugins/nereus-game/hooks/scripts/nda-guard.mjs";

const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command } });

describe("ndaGuard", () => {
  it("NDA 경로를 외부 도구에 넘기면 차단한다", () => {
    const r = ndaGuard(bash("codex review Platform/Switch/Boot.cs"));
    expect(r.block).toBe(true);
    expect(r.reason).toContain("Platform/Switch/Boot.cs");
  });

  it("NDA 경로라도 외부 도구가 아니면 막지 않는다", () => {
    expect(ndaGuard(bash("cat Platform/Switch/Boot.cs")).block).toBe(false);
  });

  it("외부 도구라도 NDA 경로가 없으면 막지 않는다", () => {
    expect(ndaGuard(bash("codex review Assets/Player.cs")).block).toBe(false);
  });

  it("NDA 파일 편집은 막지 않는다", () => {
    const edit = { tool_name: "Edit", tool_input: { file_path: "Platform/Switch/Boot.cs" } };
    expect(ndaGuard(edit).block).toBe(false);
  });

  it("warn 모드에서는 차단하지 않고 사유만 남긴다", () => {
    const r = ndaGuard(bash("agy -p Platform/Switch/Boot.cs"), { mode: "warn" });
    expect(r.block).toBe(false);
    expect(r.reason).not.toBe("");
  });
});
