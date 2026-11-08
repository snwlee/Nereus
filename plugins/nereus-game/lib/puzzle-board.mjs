// 퍼즐 판 검증기. level 은 "생성 결과를 검증 규칙과 짝지운다"고 적어두었다 — 이게 그 규칙이다.
//
// 판정 규칙은 awesome-gamedev-agent-skills 의 genres/puzzle(board-and-resolution.md)에서 왔다 —
// Copyright 2026 Abhishek Barali and contributors, Apache-2.0. 의사코드를 JS 로 다시 썼다.
//
// 매치-3: 시작 매치는 공짜 연쇄를, 데드락은 소프트락을 만든다.
// 슬라이딩: 무작위로 섞은 판은 정확히 절반이 풀 수 없다. 둘 다 플레이로는 늦게 드러난다.
import { readCliInput, runCli } from "./cli-input.mjs";

const MIN_RUN = 3;

function runsAlong(get, outer, inner, toCell) {
  const cells = [];
  for (let o = 0; o < outer; o++) {
    let run = 1;
    for (let i = 1; i <= inner; i++) {
      const same = i < inner && get(o, i) && get(o, i) === get(o, i - 1);
      if (same) { run++; continue; }
      if (run >= MIN_RUN) for (let k = i - run; k < i; k++) cells.push(toCell(o, k));
      run = 1;
    }
  }
  return cells;
}

/** 3연속 이상인 칸의 [y, x] 목록(중복 없음). 빈칸은 falsy 다. */
export function findMatches(board) {
  const h = board.length;
  const w = h ? board[0].length : 0;
  const rows = runsAlong((y, x) => board[y][x], h, w, (y, x) => [y, x]);
  const cols = runsAlong((x, y) => board[y][x], w, h, (x, y) => [y, x]);
  const seen = new Set();
  return [...rows, ...cols].filter(([y, x]) => !seen.has(`${y},${x}`) && seen.add(`${y},${x}`));
}

/** 인접 교환 하나로 매치가 생기는가. 판을 바꾸지 않도록 복사본에서 교환한다. */
export function hasValidMove(board) {
  const h = board.length;
  const w = h ? board[0].length : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (const [dy, dx] of [[0, 1], [1, 0]]) {
        const ny = y + dy;
        const nx = x + dx;
        if (ny >= h || nx >= w) continue;
        const copy = board.map((r) => [...r]);
        [copy[y][x], copy[ny][nx]] = [copy[ny][nx], copy[y][x]];
        if (findMatches(copy).length) return true;
      }
    }
  }
  return false;
}

/**
 * 빈칸(0) 목표가 오른쪽 아래인 슬라이딩 퍼즐의 패리티 판정.
 * 홀수 폭: 반전 수가 짝수면 풀린다. 짝수 폭: 반전 수 + 빈칸의 아래에서 센 행(1부터)이 홀수면 풀린다.
 */
export function slidingSolvable(tiles, width) {
  const nums = tiles.filter((t) => t !== 0);
  let inversions = 0;
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) inversions++;
  if (width % 2 === 1) return inversions % 2 === 0;
  const rows = tiles.length / width;
  const blankRowFromBottom = rows - Math.floor(tiles.indexOf(0) / width);
  return (inversions + blankRowFromBottom) % 2 === 1;
}

// 깨진 판에 그럴듯한 오답을 내지 않는다(리뷰 R1 — 빈칸 없는 슬라이딩 판이 판정을 받았다).
function validateMatch3(board) {
  const ok = Array.isArray(board) && board.length > 0 && board.every((r) => Array.isArray(r) && r.length === board[0].length);
  if (!ok) throw new Error("match3 판은 같은 길이 행들의 2차원 배열이어야 한다");
}

function validateSliding(tiles, width) {
  const ok = Array.isArray(tiles) && Number.isInteger(width) && width > 1 && tiles.length % width === 0
    && tiles.filter((t) => t === 0).length === 1;
  if (!ok) throw new Error("sliding 판은 폭으로 나누어떨어지는 길이에 빈칸(0)이 정확히 하나여야 한다");
}

export function checkBoard({ kind, board, tiles, width } = {}) {
  if (kind === "match3") {
    validateMatch3(board);
    const violations = [];
    const matches = findMatches(board);
    if (matches.length) violations.push({ code: "initial-match", cells: matches, why: "시작부터 매치가 있으면 플레이어가 두기 전에 공짜 연쇄가 터진다" });
    if (!hasValidMove(board)) violations.push({ code: "deadlock", why: "둘 수 있는 수가 없다. 섞거나 레벨을 끝내는 경로가 필요하다" });
    return { violations };
  }
  if (kind === "sliding") {
    validateSliding(tiles, width);
    return slidingSolvable(tiles, width)
      ? { violations: [] }
      : { violations: [{ code: "unsolvable-parity", why: "반전 수 패리티상 풀 수 없다. 숫자 타일 두 개를 바꾸면 패리티가 뒤집힌다" }] };
  }
  throw new Error(`알 수 없는 판 종류: ${kind} (match3 · sliding)`);
}

// 실행 진입점. stdin 으로 { kind, board | tiles, width } 를 받아 결과를 JSON 으로 낸다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(checkBoard(readCliInput())) + "\n");
  });
}
