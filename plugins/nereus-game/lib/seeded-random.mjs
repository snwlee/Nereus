// 시드 고정 난수. balance-sim 과 retry-economy 가 함께 쓴다.
//
// Math.random 을 쓰지 않는 이유: 같은 입력이면 같은 출력이어야 회귀 테스트와 게이트가 성립한다.

/** 선형합동생성기. 같은 시드면 같은 수열이다. balance-sim 에 있던 것을 코드 변경 없이 옮겼다. */
export function lcg(seed) {
  let s = (Number(seed) || 1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const ZERO_FALLBACK = 0x9e3779b9;
const utf8 = new TextEncoder();

function fnv1a(key) {
  let h = FNV_OFFSET;
  for (const byte of utf8.encode(String(key))) {
    h ^= byte;
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

function fmix32(input) {
  let h = input;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * 기본 시드와 키(레벨 id·이름)로 레벨마다 독립된 시드를 만든다.
 * LCG 는 연속 시드의 첫 값 차이가 1664525/2^32 ≈ 0.0004 라 시드를 그대로 쓰면 레벨끼리 상관된다.
 * 키를 순서가 아니라 이름으로 받아, 레벨을 끼워 넣어도 다른 레벨의 수열이 그대로다.
 * 키는 UTF-8 바이트로 해시한다 — 레벨 이름이 한글이라 인코딩을 못박아야 구현마다 같다.
 * 0 은 lcg 에서 1 로 바뀌어 seed 1 과 겹치므로 고정 상수로 바꾼다.
 */
export function mixSeed(seed, key) {
  const mixed = fmix32((fnv1a(key) ^ (Number(seed) >>> 0)) >>> 0);
  return mixed === 0 ? ZERO_FALLBACK : mixed;
}
