// doctor 원장(append-only)의 판정 로직. 파일 I/O 는 여기 없다 — 전부 순수 함수다.
//
// 원장은 두 가지를 기억한다.
//  - ack/unack: "이 충돌은 알고 있으니 그만 알려라". 지문(fingerprint)으로 식별한다.
//    지문에 양쪽 버전이 들어 있어서, 플러그인이 업데이트되면 지문이 바뀌고 다시 알린다 —
//    수용이 영구 침묵이 되지 않게 하는 장치다.
//  - apply: doctor 가 설정 파일에 무엇을 썼는지. undo 가 이걸 되돌린다.
//
// undo 는 **되돌리기가 아니라 역편집**이다. 전체 복원이면 사용자가 그 사이에 직접 한 편집까지
// 날린다. 그래서 기록한 경로 하나만 본다.
import { isDeepStrictEqual } from "node:util";

/**
 * 지문이 현재 수용(ack) 상태인지. 같은 지문의 **마지막** ack/unack 이 이긴다.
 * append-only 원장이라 취소는 삭제가 아니라 unack 줄을 덧붙이는 것으로 표현된다.
 * @param {Array<{type: string, fingerprint: string}>} entries
 * @param {string} fingerprint
 */
export function isAcked(entries, fingerprint) {
  let acked = false;
  for (const e of entries ?? []) {
    if (e?.fingerprint !== fingerprint) continue;
    if (e.type === "ack") acked = true;
    else if (e.type === "unack") acked = false;
  }
  return acked;
}

/**
 * apply 기록 하나를 되돌릴 수 있는지 판정한다. 파일을 쓰지 않는다 — 계획만 낸다.
 *
 * 판정 순서가 중요하다. **부재 검사가 해시 검사보다 앞선다** — 사용자가 이미 손으로 지웠으면
 * 되돌릴 것이 없고, 그건 실패가 아니라 성공(idempotent)이다. 해시 검사를 먼저 두면
 * 해시가 같은데 경로만 사라진 경우를 revert 로 판정해 없는 것을 지우려 든다.
 *
 * @param {object} o
 * @param {{path: string[], before: any, after: any, fileHash: string}} o.entry 원장의 apply 줄
 * @param {{hash: string, valueAt: (path: string[]) => any}} o.currentFile 현재 설정 파일
 * @returns {{action: "revert"|"noop"|"stop", reason?: string, expected?: any, actual?: any}}
 */
export function planUndo({ entry, currentFile }) {
  const actual = currentFile.valueAt(entry.path);

  // 이미 없다. 되돌릴 것이 없으니 성공으로 끝낸다.
  if (actual === undefined) return { action: "noop", reason: "path-absent" };

  // 파일이 그때 그대로다. 안전하게 되돌린다.
  if (currentFile.hash === entry.fileHash) return { action: "revert", reason: "hash-match" };

  // 파일은 바뀌었지만 우리가 건드린 경로는 그대로다. 그 경로만 되돌린다.
  if (isDeepStrictEqual(actual, entry.after)) return { action: "revert", reason: "path-intact" };

  // 기록한 경로 자체가 바뀌었다(드리프트). 사용자의 편집을 덮지 않고 멈추고 보고한다.
  return { action: "stop", reason: "drift", expected: entry.after, actual };
}
