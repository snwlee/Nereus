// 처방 적용과 스코프별 원장 경로. 파일 I/O 는 없다 — 새 settings 와 원장 줄을 만들어 돌려줄 뿐,
// 실제 쓰기는 호출 측이 원자적 쓰기(임시 파일 + rename)로 한다.
import { createHash } from "node:crypto";

const HASH_LENGTH = 16;
const DENY_PATH = ["permissions", "deny"];

/** 설정 파일 해시. planUndo 의 `currentFile.hash` 와 같은 규약을 써야 비교가 성립한다. */
export function hashSettings(settings) {
  return createHash("sha256").update(JSON.stringify(settings)).digest("hex").slice(0, HASH_LENGTH);
}

/**
 * 충돌 하나의 처방을 settings 에 적용한 **새 객체**를 만든다. 입력은 건드리지 않는다.
 *
 * 적용 가능한 처방만 받는다. 수동 처방(스킬 충돌 등)을 조용히 무시하면 doctor 가 고친 척하게
 * 되는데, 그게 이 도구에서 가장 나쁜 거짓말이다 — 그래서 무시가 아니라 오류다.
 *
 * @param {object} o
 * @param {{fingerprint: string, remedy: {applicable: boolean, kind?: string, value?: string}}} o.conflict
 * @param {object} o.settings 원본 설정(변형하지 않는다)
 * @param {number} o.now 원장에 남길 시각
 * @returns {{settings: object, entry: object|null}} 이미 적용돼 있으면 entry 는 null 이다
 */
export function applyRemedy({ conflict, settings, now }) {
  const remedy = conflict?.remedy;
  if (!remedy?.applicable) {
    throw new Error(`수동 처방이라 파일로 적용할 수 없습니다: ${conflict?.kind} / ${conflict?.unit}`);
  }
  if (remedy.kind !== "permissions-deny") {
    throw new Error(`알 수 없는 처방 종류라 적용하지 않습니다: ${remedy.kind}`);
  }

  const next = structuredClone(settings ?? {});
  const before = settings?.permissions?.deny;

  // 이미 있으면 아무것도 하지 않는다. 원장에도 남기지 않는다 — 되돌릴 변경이 없기 때문이다.
  if (Array.isArray(before) && before.includes(remedy.value)) return { settings: next, entry: null };

  const after = [...(before ?? []), remedy.value];
  next.permissions = { ...(next.permissions ?? {}), deny: after };

  return {
    settings: next,
    entry: {
      type: "apply",
      at: now,
      fingerprint: conflict.fingerprint,
      path: DENY_PATH,
      before,
      after,
      fileHash: hashSettings(next),
    },
  };
}

/**
 * 스코프별 원장 경로.
 *
 * 전역 판정은 사용자 설정 디렉터리에, 프로젝트 판정은 프로젝트 안에 남긴다. 프로젝트 수용을
 * 전역에 남기면 다른 프로젝트에서도 조용해져서, 거기서는 여전히 시끄러워야 할 충돌을 놓친다.
 *
 * 경로를 `/` 로 직접 잇는다. 테스트가 두 플랫폼에서 같은 문자열을 요구하고, Node 는 Windows
 * 에서도 `/` 를 받는다. 다만 이 때문에 `paths.mjs` 의 win32 AppData 분기를 타지 않는다 —
 * Windows 에서 사용자 설정 디렉터리가 AppData 라면 원장만 `.config` 에 남는다. T5 에서 정리한다.
 */
export function ledgerPathFor(scope, { home, cwd }) {
  return scope === "project"
    ? `${cwd}/.nereus/doctor-ack.jsonl`
    : `${home}/.config/nereus/doctor-ledger.jsonl`;
}
