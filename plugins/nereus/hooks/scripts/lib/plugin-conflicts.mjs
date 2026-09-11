// 구조적 충돌 판정과 지문. 입력은 plugin-inventory 의 PluginRecord[] 이다.
//
// 구조적 충돌은 이름 공간이 하나뿐인 표면(MCP 서버명·에이전트명·bin 이름)에서 활성 플러그인
// 둘 이상이 같은 이름을 쓸 때 일어난다 — 한쪽이 다른 쪽을 가린다(섀도잉). HIGH 다.
// 훅은 같은 지점에 둘 다 붙어도 둘 다 실행되고 순서만 불확실하므로 LOW 로만 알린다.
//
// 비활성 플러그인은 판정에 넣지 않는다. 꺼둔 플러그인은 아무것도 가리지 못한다.
//
// 지문은 "같은 충돌" 을 원장(ack)에서 다시 찾기 위한 키다. 양쪽의 이름@버전과 kind, unit 만으로
// 만들어 순서에 무관하고, 한쪽 버전이 바뀌면 달라진다 — 업데이트 뒤에는 다시 알려야 하기 때문이다.
import { createHash } from "node:crypto";

const FINGERPRINT_LENGTH = 16;

/** 표면 종류별 판정 규격. remedy 는 unit 을 받아 처방을 만든다. */
const SHADOW_RULES = [
  {
    surface: "mcp",
    kind: "mcp-shadow",
    remedy: (unit) => ({ applicable: true, kind: "permissions-deny", value: "mcp__" + unit }),
  },
  {
    surface: "agents",
    kind: "agent-shadow",
    remedy: (unit) => ({ applicable: true, kind: "permissions-deny", value: "Agent(" + unit + ")" }),
  },
  {
    // bin 은 PATH 순서 문제라 settings 로 못 고친다. 수동 처방만 가능하다.
    surface: "bins",
    kind: "bin-shadow",
    remedy: () => ({ applicable: false }),
  },
];

const HOOK_RULE = {
  kind: "hook-shared",
  severity: "LOW",
  remedy: () => ({ applicable: false }),
};

/** 레코드 배열을 unit 이름 → 레코드 목록으로 묶는다. unitsOf 가 레코드에서 유닛 이름들을 꺼낸다. */
function groupByUnit(records, unitsOf) {
  const groups = new Map();
  for (const record of records) {
    for (const unit of unitsOf(record)) {
      const list = groups.get(unit) ?? [];
      groups.set(unit, [...list, record]);
    }
  }
  return groups;
}

function sidesOf(records) {
  return records.map(({ name, version }) => ({ name, version }));
}

function conflictsFor(groups, { kind, severity, remedy }, scope) {
  const out = [];
  for (const [unit, records] of groups) {
    if (records.length < 2) continue;
    const sides = sidesOf(records);
    const conflict = { severity, kind, unit, scope, sides, remedy: remedy(unit) };
    out.push({ ...conflict, fingerprint: fingerprint(conflict) });
  }
  return out;
}

/**
 * 활성 플러그인 사이의 구조적 충돌을 판정한다.
 * @param {Array<{name, version, enabled, surfaces}>} records plugin-inventory 의 반환값
 * @param {"global"|"project"} scope 판정이 속한 설정 스코프
 * @returns {Array<{severity, kind, unit, scope, sides, remedy, fingerprint}>}
 */
export function structuralConflicts(records, scope) {
  const active = (records ?? []).filter((r) => r?.enabled === true);

  const shadows = SHADOW_RULES.flatMap((rule) =>
    conflictsFor(
      groupByUnit(active, (r) => r.surfaces?.[rule.surface] ?? []),
      { ...rule, severity: "HIGH" },
      scope,
    ),
  );

  const hooks = conflictsFor(
    groupByUnit(active, (r) => (r.surfaces?.hooks ?? []).map((h) => h.event + "|" + h.matcher)),
    HOOK_RULE,
    scope,
  );

  return [...shadows, ...hooks];
}

/**
 * 충돌의 지문. kind, 정렬한 이름@버전 목록, unit 을 이어 sha256 한 앞 16자.
 * @param {{kind: string, unit: string, sides: Array<{name, version}>}} conflict
 * @returns {string}
 */
export function fingerprint({ kind, unit, sides }) {
  const sideKeys = (sides ?? []).map((s) => s.name + "@" + s.version).sort();
  return createHash("sha256")
    .update([kind, ...sideKeys, unit].join("\n"))
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);
}
