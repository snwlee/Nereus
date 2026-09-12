import { describe, it, expect } from "vitest";
import { luauCheck } from "../../plugins/nereus-game/hooks/scripts/luau-check.mjs";

const roblox = { exists: (p: string) => p.endsWith("default.project.json") };
const notRoblox = { exists: () => false };

const deps = (present: string[], fail: string[] = []) => ({
  which: (cmd: string) => present.includes(cmd),
  run: (cmd: string, args: string[]) => ({
    label: `${cmd} ${args.join(" ")}`,
    status: fail.includes(cmd) ? 1 : 0,
    output: fail.includes(cmd) ? `${cmd}: 3 warnings` : "",
  }),
  warn: (msg: string) => warnings.push(msg),
});
let warnings: string[] = [];

describe("luauCheck", () => {
  it("luau 파일이면 stylua 와 selene 를 돌린다", () => {
    warnings = [];
    const out = luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps(["stylua", "selene"]), roblox);
    expect(out).toEqual(["stylua /p/src/Main.luau", "selene /p/src/Main.luau"]);
  });

  it("린트가 위반을 찾으면 조용히 넘기지 않고 경고로 올린다", () => {
    warnings = [];
    luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps(["stylua", "selene"], ["selene"]), roblox);
    expect(warnings.join("\n")).toContain("selene");
    expect(warnings.join("\n")).toContain("3 warnings");
  });

  it("도구가 없으면 건너뛴다", () => {
    expect(luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps([]), roblox)).toEqual([]);
  });

  it("luau 가 아닌 파일은 아무것도 안 한다", () => {
    expect(luauCheck({ tool_input: { file_path: "/p/src/a.ts" } }, deps(["stylua", "selene"]), roblox)).toEqual([]);
  });
});

describe("로블록스 프로젝트 게이팅", () => {
  it("로블록스 프로젝트가 아니면 도구가 있어도 돌리지 않는다", () => {
    warnings = [];
    const out = luauCheck({ tool_input: { file_path: "/p/src/Main.luau" } }, deps(["stylua", "selene"]), notRoblox);
    expect(out).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
