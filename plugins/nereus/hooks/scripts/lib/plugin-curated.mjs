// 큐레이션 충돌 표. 이름이 같지 않아 구조적으로는 잡히지 않지만, 두 플러그인이
// 함께 켜져 있으면 같은 일을 두 번 하는(이중 게이트·이중 메모리) 조합을 손으로 적어 둔다.
//
// 구조적 판정(plugin-conflicts.mjs)과 달리 여기 항목은 파일 한 줄로 고칠 수 없다.
// 스킬은 permissions.deny 로 가릴 수 없으므로 처방은 전부 수동(/plugin 화면에서 끄기)이다.
// 그래서 severity 는 MEDIUM 으로 고정하고 remedy.applicable 은 항상 false 다.
//
// 항목을 추가할 때는 evidence 에 근거 한 문장을 꼭 쓴다. 근거 없는 항목은 테스트가 막는다.

/** 플러그인 이름에서 마켓플레이스 접미를 뗀다. superpowers@obra → superpowers */
function baseName(name) {
  return String(name).split("@")[0];
}

/**
 * @typedef {object} CuratedEntry
 * @property {[string, string]} pair   함께 활성이면 충돌하는 두 플러그인의 기본 이름
 * @property {string} kind             충돌 종류
 * @property {string} unit             겹치는 단위(스킬명 등)
 * @property {string} evidence         근거 한 문장
 * @property {string} remedy           수동 처방 문자열
 */

/** @type {CuratedEntry[]} */
export const CURATED = [
  {
    pair: ["superpowers", "nereus"],
    kind: "double-gate",
    unit: "verification-before-completion",
    evidence:
      "superpowers 의 verification-before-completion 과 nereus:finish 가 같은 완료 게이트를 두 번 돌려 매 마무리마다 검증이 중복된다.",
    remedy: "/plugin 화면에서 superpowers 의 verification-before-completion 스킬을 끄거나 superpowers 를 비활성화한다.",
  },
  {
    pair: ["ecc", "nereus"],
    kind: "double-memory",
    unit: "unified-memory",
    evidence:
      "ecc 의 unified-memory 스킬은 nereus 가 세션 메모리로 쓰는 claude-mem 과 같은 역할을 해 기억이 두 곳에 갈라져 저장된다.",
    remedy: "/plugin 화면에서 ecc 의 unified-memory 스킬을 끄고 claude-mem 하나만 남긴다.",
  },
];

/**
 * 큐레이션 표를 인벤토리에 대조해 양쪽이 모두 활성인 항목만 Conflict 로 낸다.
 * @param {Array<{name, version, enabled}>} records readInventory 결과
 * @param {"global"|"project"} scope
 */
export function curatedConflicts(records, scope) {
  const active = new Map();
  for (const r of records) {
    if (r?.enabled === true) active.set(baseName(r.name), r);
  }

  return CURATED.flatMap((entry) => {
    const sides = entry.pair.map((p) => active.get(p));
    if (sides.some((s) => !s)) return [];
    return [
      {
        severity: "MEDIUM",
        kind: entry.kind,
        unit: entry.unit,
        scope,
        sides: sides.map((s) => ({ name: s.name, version: s.version })),
        evidence: entry.evidence,
        remedy: { applicable: false, manual: entry.remedy },
      },
    ];
  });
}
