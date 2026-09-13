import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { workTreeHash, recordEvidence, evidenceStatus } from "../../plugins/nereus/hooks/scripts/lib/evidence.mjs";

const git = (map: Record<string, string>) => (args: string[]) => ({ ok: true, stdout: map[args.join(" ")] ?? "", stderr: "" });

describe("evidence gate", () => {
  it("hashes HEAD + status + diff deterministically", () => {
    const run = git({ "rev-parse HEAD": "abc\n", "status --porcelain": " M a.ts\n", "diff HEAD": "+x\n" });
    const h1 = workTreeHash("/r", { run });
    const h2 = workTreeHash("/r", { run });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
    const run2 = git({ "rev-parse HEAD": "abc\n", "status --porcelain": " M a.ts\n", "diff HEAD": "+y\n" });
    expect(workTreeHash("/r", { run: run2 })).not.toBe(h1);
  });
  it("records evidence and reports FRESH, then STALE after tree changes, MISSING when absent", () => {
    let store: string | null = null;
    const io = { readFile: () => { if (store === null) throw new Error("ENOENT"); return store; }, writeFile: (_: string, s: string) => { store = s; } };
    let tree = "aaaa";
    const hash = () => tree;
    expect(evidenceStatus("/r", { ...io, hash })).toEqual({ status: "MISSING" });
    recordEvidence("/r", { command: "npm test", exitCode: 0 }, { ...io, hash, now: 1000 });
    expect(evidenceStatus("/r", { ...io, hash })).toMatchObject({ status: "FRESH", exitCode: 0, command: "npm test" });
    tree = "bbbb";
    expect(evidenceStatus("/r", { ...io, hash })).toMatchObject({ status: "STALE" });
  });
  it("FRESH with non-zero exit is still reported as failing evidence", () => {
    let store: string | null = null;
    const io = { readFile: () => { if (store === null) throw new Error("ENOENT"); return store; }, writeFile: (_: string, s: string) => { store = s; }, hash: () => "h", now: 1 };
    recordEvidence("/r", { command: "npm test", exitCode: 1 }, io);
    expect(evidenceStatus("/r", io)).toMatchObject({ status: "FRESH", exitCode: 1, passing: false });
  });
});

// 실제 git 으로 돈다. 주입한 run 픽스처는 **우리가 부르는 인자 자체가 틀린 경우**를 못 잡는다 —
// fix-game-real-project 에서 하네스 출력 형식으로 쓴 픽스처가 결함 셋을 전부 놓친 것과 같은 양상이다.
describe("workTreeHash — 실제 저장소", () => {
  const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-evidence-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.email", "t@t");
    git(dir, "config", "user.name", "t");
    fs.writeFileSync(path.join(dir, "tracked.txt"), "a\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "init");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("추적되지 않은 새 파일의 내용이 바뀌면 해시가 바뀐다", () => {
    const f = path.join(dir, "new.mjs");
    fs.writeFileSync(f, "export const a = 1;\n");
    const before = workTreeHash(dir);
    fs.writeFileSync(f, "export const a = 2;\n");
    expect(workTreeHash(dir)).not.toBe(before);
  });

  it("추적 파일 수정도 여전히 잡는다", () => {
    const before = workTreeHash(dir);
    fs.writeFileSync(path.join(dir, "tracked.txt"), "b\n");
    expect(workTreeHash(dir)).not.toBe(before);
  });

  it("아무것도 안 바뀌면 같은 해시다", () => {
    expect(workTreeHash(dir)).toBe(workTreeHash(dir));
  });

  it("gitignore 된 파일은 해시에 들어가지 않는다 — 빌드 산출물로 매번 STALE 이 되면 게이트를 끈다", () => {
    fs.writeFileSync(path.join(dir, ".gitignore"), "out/\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "ignore");
    fs.mkdirSync(path.join(dir, "out"));
    fs.writeFileSync(path.join(dir, "out", "bundle.js"), "1");
    const before = workTreeHash(dir);
    fs.writeFileSync(path.join(dir, "out", "bundle.js"), "2");
    expect(workTreeHash(dir)).toBe(before);
  });
});
