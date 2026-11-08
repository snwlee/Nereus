import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { checkSave } from "../../plugins/nereus-game/lib/save-check.mjs";

const good = {
  currentVersion: 3,
  migrations: [1, 2],
  write: "atomic-rename",
  backup: true,
  autosave: { separateSlot: true },
  newerVersion: "refuse",
  fixtures: [1, 2, 3],
  fields: [{ name: "coins" }, { name: "seed" }],
};
const codes = (r: any) => r.violations.map((v: any) => v.code);

describe("세이브 검사", () => {
  it("갖출 것을 다 갖추면 위반 0", () => {
    expect(checkSave(good).violations).toEqual([]);
  });
  it("버전 필드가 없으면 no-version", () => {
    expect(codes(checkSave({ ...good, currentVersion: undefined }))).toContain("no-version");
  });
  it("빠진 마이그레이션 단계를 짚는다", () => {
    const r = checkSave({ ...good, migrations: [1] });
    expect(r.violations.find((v: any) => v.code === "migration-gap").missing).toEqual([2]);
  });
  it("제자리 쓰기·백업 없음·자동저장 덮어쓰기·새 버전 수용을 각각 짚는다", () => {
    const r = checkSave({ ...good, write: "in-place", backup: false, autosave: { separateSlot: false }, newerVersion: "load" });
    expect(codes(r)).toEqual(expect.arrayContaining(["in-place-write", "no-backup", "autosave-clobber", "newer-not-refused"]));
  });
  it("버전별 회귀 표본이 빠지면 fixture-gap", () => {
    expect(checkSave({ ...good, fixtures: [3] }).violations.find((v: any) => v.code === "fixture-gap").missing).toEqual([1, 2]);
  });
  it("파생 데이터를 저장하면 derived-stored", () => {
    expect(codes(checkSave({ ...good, fields: [{ name: "dps", derived: true }] }))).toContain("derived-stored");
  });
  it("프로세스로 돌면 stdout JSON 을 낸다", () => {
    const out = execFileSync("node", ["plugins/nereus-game/lib/save-check.mjs"], {
      input: JSON.stringify({ plan: { ...good, write: "in-place" } }),
      encoding: "utf8",
    });
    expect(JSON.parse(out).violations.map((v: any) => v.code)).toContain("in-place-write");
  });
});
