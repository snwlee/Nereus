import { describe, it, expect } from "vitest";
import { lcg, mixSeed } from "../../plugins/nereus-game/lib/seeded-random.mjs";

// 기대값은 저장소 밖 Python 참조 구현(UTF-8 FNV-1a ^ seed → fmix32, 0 이면 0x9e3779b9)으로 미리 계산했다.
// 자기 출력을 스냅샷으로 박으면 알고리즘이 바뀌어도 초록이라 고정값의 의미가 없다.
describe("seeded-random", () => {
  it("한글 키의 시드는 고정값이다", () => {
    expect(mixSeed(1, "레벨1")).toBe(1789633814);
    expect(mixSeed(1, "L1")).toBe(2309713719);
    expect(mixSeed(7, "continue")).toBe(1451885671);
  });

  it("lcg 수열은 옮기기 전과 같다", () => {
    const r = lcg(1);
    expect([r(), r(), r()]).toEqual([0.23645552527159452, 0.3692706737201661, 0.5042420323006809]);
  });

  it("이름이 이웃한 레벨도 첫 값이 붙어 있지 않다", () => {
    // 섞지 않은 연속 시드는 첫 값 차이가 1664525/2^32 ≈ 0.0004 다. 그 25배를 하한으로 잡는다.
    const firsts = ["L1", "L2", "L3", "L4"].map((n) => lcg(mixSeed(1, n))());
    for (let i = 1; i < firsts.length; i++) expect(Math.abs(firsts[i] - firsts[i - 1])).toBeGreaterThan(0.01);
  });

  it("같은 이름은 같은 시드다", () => {
    expect(mixSeed(3, "레벨")).toBe(mixSeed(3, "레벨"));
    expect(mixSeed(3, "레벨")).not.toBe(mixSeed(4, "레벨"));
  });
});
