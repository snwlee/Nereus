import { describe, it, expect } from "vitest";
import { luauCheck } from "../../plugins/nereus-game/hooks/scripts/luau-check.mjs";

const deps = (present: string[]) => ({
  which: (cmd: string) => present.includes(cmd),
  run: (cmd: string, args: string[]) => `${cmd} ${args.join(" ")}`,
});

describe("luauCheck", () => {
  it("luau 파일이면 stylua 와 selene 를 돌린다", () => {
    const out = luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps(["stylua", "selene"]));
    expect(out).toEqual(["stylua /p/src/Main.luau", "selene /p/src/Main.luau"]);
  });

  it("도구가 없으면 건너뛴다", () => {
    expect(luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps([]))).toEqual([]);
  });

  it("luau 가 아닌 파일은 아무것도 안 한다", () => {
    expect(luauCheck({ tool_input: { file_path: "/p/src/a.ts" } }, deps(["stylua", "selene"]))).toEqual([]);
  });
});
