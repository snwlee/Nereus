// doctor CLI — 플러그인 충돌 리포트. 기본 동작은 **읽기 전용**이다.
//
// 진단기가 묻지 않고 고치면 사용자는 자기 설정이 언제 바뀌었는지 모른다. 그래서 인자 없이
// 부르면 아무것도 쓰지 않고, 파괴적 명령(`/plugin uninstall`)은 실행하지 않고 문자열로만 낸다.
// 플러그인 제거는 사용자가 자기 손으로 해야 하는 일이다.

const SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW"];

/** 처방 칸. 적용 불가면 "수동" 으로 표시하고 무엇을 해야 하는지 그대로 보여준다. */
function remedyCell(remedy) {
  if (remedy?.applicable) return `자동: permissions.deny 에 ${remedy.value} 추가`;
  return remedy?.manual ? `수동: ${remedy.manual}` : "수동: 자동 처방 없음";
}

function line(c) {
  const head = `[${c.severity}] ${c.kind} — ${c.unit}`;
  const rows = [head, `        ${remedyCell(c.remedy)}`];
  if (c.evidence) rows.splice(1, 0, `        근거: ${c.evidence}`);
  return rows.join("\n");
}

/**
 * 충돌 목록을 사람이 읽는 리포트로 만든다.
 *
 * LOW 는 기본으로 접는다. 훅이 같은 지점에 붙는 것은 대개 정상이고, 이걸 매번 펼치면
 * 경고 피로로 HIGH 까지 같이 무시하게 된다. 대신 몇 건인지는 항상 알린다.
 *
 * @param {Array<object>} conflicts
 * @param {{all?: boolean}} opts
 * @returns {string}
 */
export function renderReport(conflicts, opts = {}) {
  const all = opts.all === true;
  const list = [...(conflicts ?? [])].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const shown = all ? list : list.filter((c) => c.severity !== "LOW");
  const hiddenLow = list.length - shown.length;

  const out = [];
  out.push(shown.length ? shown.map(line).join("\n\n") : "충돌 없음.");
  if (hiddenLow > 0) out.push(`\nLOW ${hiddenLow}건은 접었습니다. --all 로 펼칩니다.`);
  return out.join("\n");
}

/**
 * CLI 진입점. 부수 효과는 전부 deps 로 주입받는다 — 테스트가 실제 파일·프로세스를 건드리지 않는다.
 *
 * @param {string[]} argv
 * @param {{conflicts: Array<object>, run: Function, write: Function}} deps
 * @returns {{output: string}}
 */
export function runDoctor(argv = [], deps = {}) {
  const all = argv.includes("--all");
  const removeAt = argv.indexOf("--remove");
  const out = [renderReport(deps.conflicts, { all })];

  if (removeAt !== -1) {
    const target = argv[removeAt + 1];
    // 실행하지 않는다. 사용자가 직접 쳐야 하는 명령으로만 보여준다.
    out.push(`\n제거하려면 직접 실행하세요:\n  /plugin uninstall ${target}`);
  }

  return { output: out.join("\n") };
}
