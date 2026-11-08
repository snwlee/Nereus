import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { findMatches, hasValidMove, slidingSolvable, checkBoard } from "../../plugins/nereus-game/lib/puzzle-board.mjs";

const codes = (r: any) => r.violations.map((v: any) => v.code);
const playable = [[1, 1, 2], [2, 3, 1], [3, 2, 3]];

describe("매치-3 판", () => {
  it("시작부터 3연속이 있으면 initial-match", () => {
    expect(findMatches([[1, 1, 1], [2, 3, 2], [3, 2, 3]])).toHaveLength(3);
    expect(codes(checkBoard({ kind: "match3", board: [[1, 1, 1], [2, 3, 2], [3, 2, 3]] }))).toContain("initial-match");
  });
  it("둘 수 있는 수가 있고 시작 매치가 없으면 통과", () => {
    expect(hasValidMove(playable)).toBe(true);
    expect(checkBoard({ kind: "match3", board: playable }).violations).toEqual([]);
  });
  it("어떤 교환도 매치를 못 만들면 deadlock", () => {
    expect(codes(checkBoard({ kind: "match3", board: [[1, 2], [2, 1]] }))).toEqual(["deadlock"]);
  });
  it("검사가 판을 바꾸지 않는다", () => {
    const b = playable.map((r) => [...r]);
    hasValidMove(b);
    expect(b).toEqual(playable);
  });
});

describe("슬라이딩 판 패리티", () => {
  it("홀수 폭: 반전 수가 짝수면 풀린다", () => {
    expect(slidingSolvable([1, 2, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(true);
    expect(slidingSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
  });
  it("짝수 폭: 반전 수 + 빈칸의 아래에서 센 행이 홀수면 풀린다", () => {
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    expect(slidingSolvable(solved, 4)).toBe(true);
    expect(slidingSolvable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0], 4)).toBe(false);
    expect(codes(checkBoard({ kind: "sliding", tiles: [2, 1, 3, 4, 5, 6, 7, 8, 0], width: 3 }))).toEqual(["unsolvable-parity"]);
  });
  it("알 수 없는 종류는 던진다", () => {
    expect(() => checkBoard({ kind: "hex" } as any)).toThrow();
  });
  it("프로세스로 돌면 stdout JSON 을 낸다", () => {
    const out = execFileSync("node", ["plugins/nereus-game/lib/puzzle-board.mjs"], {
      input: JSON.stringify({ kind: "match3", board: [[1, 2], [2, 1]] }),
      encoding: "utf8",
    });
    expect(JSON.parse(out).violations[0].code).toBe("deadlock");
  });
// 리뷰 R1: 빈칸이 없거나 폭이 맞지 않는 판에 그럴듯한 오답을 냈다.
describe("깨진 판 입력", () => {
  it("슬라이딩 판에 빈칸이 정확히 하나가 아니거나 폭이 맞지 않으면 던진다", () => {
    expect(() => checkBoard({ kind: "sliding", tiles: [1, 2, 3, 4], width: 2 })).toThrow();
    expect(() => checkBoard({ kind: "sliding", tiles: [1, 2, 0, 3, 4], width: 2 })).toThrow();
  });
  it("매치-3 판이 직사각형 배열이 아니면 던진다", () => {
    expect(() => checkBoard({ kind: "match3", board: [[1, 2], [1]] })).toThrow();
    expect(() => checkBoard({ kind: "match3" } as any)).toThrow();
  });
});
});
