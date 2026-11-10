import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { extractRefs, checkRefs, listDocs, driftReport } from "../../plugins/nereus/skills/drift/scripts/drift.mjs";

const SCRIPT = path.resolve("plugins/nereus/skills/drift/scripts/drift.mjs");
const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "drift-")));
const write = (dir: string, rel: string, body: string) => {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

describe("extractRefs", () => {
  it("백틱 경로와 링크 경로를 뽑고 줄 번호·앵커를 뗀다", () => {
    const md = "진입점 `src/a.ts:40-55` 와 [설계](../docs/b.md#goals), `./c.json`, `lib/`";
    expect(extractRefs(md).paths).toEqual(["src/a.ts", "./c.json", "lib/", "../docs/b.md"]);
  });
  it("경로처럼 생기지 않은 슬래시 단어·URL·변수는 버린다", () => {
    const md = "`CRITICAL/HIGH` `https://x.dev/a.md` `${ROOT}/a.mjs` `~/x.md` `a b/c.ts` `*.md` [w](https://e.com)";
    expect(extractRefs(md).paths).toEqual([]);
  });
  it("호출 형태 백틱에서 심볼 이름을 뽑는다", () => {
    const md = "`resolveTarget(target, cwd)` 와 `Ledger.judge()` 와 `plain`";
    expect(extractRefs(md).symbols).toEqual(["resolveTarget", "judge"]);
  });
  it("펜스 코드 블록 안의 이름은 참조로 뽑지 않는다", () => {
    const md = "```ts\nconst x = `src/in.ts`; foo();\n```\n`bar()`";
    const r = extractRefs(md);
    expect(r.paths).toEqual([]);
    expect(r.symbols).toEqual(["bar"]);
  });
  it("중복은 한 번만", () => {
    expect(extractRefs("`a/b.ts` `a/b.ts` `x()` `x()`")).toEqual({ paths: ["a/b.ts"], symbols: ["x"] });
  });
});

describe("checkRefs", () => {
  it("문서 폴더와 저장소 루트 어느 쪽에도 없는 경로만 missing", () => {
    const d = tmp();
    write(d, "src/a.ts", "");
    write(d, "docs/near.md", "");
    const r = checkRefs({ paths: ["src/a.ts", "near.md", "src/gone.ts"], symbols: [] }, { docDir: path.join(d, "docs"), cwd: d });
    expect(r.missingPaths).toEqual(["src/gone.ts"]);
  });
  it("저장소 파일 목록의 접미사와 맞으면 존재로 친다 (플러그인 기준 상대 경로)", () => {
    const files = ["plugins/game/skills/craft/SKILL.md", "plugins/game/hooks/hooks.json"];
    const r = checkRefs({ paths: ["skills/craft/SKILL.md", "hooks/", "kills/craft/SKILL.md"], symbols: [] }, { docDir: "/nope", cwd: "/nope", files });
    expect(r.missingPaths).toEqual(["kills/craft/SKILL.md"]);
  });
  it("심볼은 주입한 검색기로 판정하고, 모르면 unchecked", () => {
    const hasSymbol = (n: string) => (n === "a" ? true : n === "b" ? false : null);
    const r = checkRefs({ paths: [], symbols: ["a", "b", "c"] }, { docDir: "/", cwd: "/", hasSymbol });
    expect(r.missingSymbols).toEqual(["b"]);
    expect(r.uncheckedSymbols).toEqual(["c"]);
  });
});

describe("listDocs", () => {
  it("디렉터리에서 md 만 재귀로, node_modules·.git 은 건너뛴다", () => {
    const d = tmp();
    write(d, "a.md", "");
    write(d, "sub/b.md", "");
    write(d, "sub/c.txt", "");
    write(d, "node_modules/x.md", "");
    expect(listDocs(d).map((p: string) => path.relative(d, p))).toEqual(["a.md", path.join("sub", "b.md")]);
  });
  it("파일은 그대로, 없는 대상은 던진다", () => {
    const d = tmp();
    const f = write(d, "x.md", "");
    expect(listDocs(f)).toEqual([f]);
    expect(() => listDocs(path.join(d, "none"))).toThrow();
  });
});

describe("driftReport", () => {
  it("문서마다 누락을 싣고 드리프트 있는 문서 수를 센다", () => {
    const d = tmp();
    write(d, "src/a.ts", "export function here() {}");
    write(d, "docs/ok.md", "`src/a.ts` `here()`");
    write(d, "docs/bad.md", "`src/old.ts` `gone()`");
    const hasSymbol = (n: string) => n === "here";
    const r = driftReport([path.join(d, "docs")], { cwd: d, hasSymbol });
    expect(r.summary).toEqual({ docs: 2, withDrift: 1 });
    const bad = r.docs.find((x: { doc: string }) => x.doc.endsWith("bad.md"));
    expect(bad.missingPaths).toEqual(["src/old.ts"]);
    expect(bad.missingSymbols).toEqual(["gone"]);
  });
});

describe("CLI", () => {
  it("git 저장소에서 심볼을 git grep 으로 찾는다", () => {
    const d = tmp();
    write(d, "src/a.mjs", "export function realOne() {}\n");
    write(d, "docs/x.md", "`realOne()` `ghostFn()` `src/a.mjs`");
    execFileSync("git", ["init", "-q"], { cwd: d });
    execFileSync("git", ["add", "."], { cwd: d });
    const out = JSON.parse(execFileSync("node", [SCRIPT, "docs"], { cwd: d, encoding: "utf8" }));
    expect(out.docs[0].missingSymbols).toEqual(["ghostFn"]);
    expect(out.docs[0].missingPaths).toEqual([]);
  });
  it("문서 안에만 있는 이름은 존재로 치지 않는다", () => {
    const d = tmp();
    write(d, "docs/x.md", "`onlyInDocs()`");
    execFileSync("git", ["init", "-q"], { cwd: d });
    execFileSync("git", ["add", "."], { cwd: d });
    const out = JSON.parse(execFileSync("node", [SCRIPT, "docs"], { cwd: d, encoding: "utf8" }));
    expect(out.docs[0].missingSymbols).toEqual(["onlyInDocs"]);
  });
  it("대상이 없으면 종료코드 2", () => {
    expect(() => execFileSync("node", [SCRIPT], { stdio: "pipe" })).toThrow();
  });
});
