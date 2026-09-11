// doctor CLI — 플러그인 충돌 리포트. 기본 동작은 **읽기 전용**이다.
//
// 진단기가 묻지 않고 고치면 사용자는 자기 설정이 언제 바뀌었는지 모른다. 그래서 인자 없이
// 부르면 아무것도 쓰지 않고, 파괴적 명령(`/plugin uninstall`)은 실행하지 않고 문자열로만 낸다.
// 플러그인 제거는 사용자가 자기 손으로 해야 하는 일이다.

import { applyRemedy, hashSettings } from "./apply.mjs";
import { isAcked, planUndo } from "../../../hooks/scripts/lib/doctor-ledger.mjs";

const SEVERITY_ORDER = ["HIGH", "MEDIUM", "LOW"];

/** 경로를 따라 값을 읽는다. 중간이 비면 undefined. */
function valueAt(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** 경로에 값을 넣은 **새 객체**. value 가 undefined 면 그 키를 지운다(적용 전 상태로 되돌리기). */
function setAt(obj, path, value) {
  const [key, ...rest] = path;
  const next = { ...(obj ?? {}) };
  if (rest.length) {
    next[key] = setAt(next[key], rest, value);
  } else if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

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
  const ledger = deps.ledger ?? [];
  const appendLedger = deps.appendLedger ?? (() => {});
  const writeSettings = deps.writeSettings ?? (() => {});
  const at = deps.now ?? Date.now();
  const argAfter = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };

  // 수용된 충돌은 리포트에서 뺀다. 지문에 버전이 들어 있어 업데이트되면 다시 나타난다.
  const visible = (deps.conflicts ?? []).filter((c) => !isAcked(ledger, c.fingerprint));

  for (const type of ["ack", "unack"]) {
    if (!argv.includes(`--${type}`)) continue;
    const fingerprint = argAfter(`--${type}`);
    appendLedger({ type, fingerprint, at });
    return { output: `${type === "ack" ? "수용" : "수용 취소"}: ${fingerprint}` };
  }

  if (argv.includes("--undo")) return { output: undo({ ledger, settings: deps.settings, writeSettings }) };
  if (argv.includes("--apply")) return { output: apply({ visible, settings: deps.settings, writeSettings, appendLedger, at }) };

  const out = [renderReport(visible, { all })];
  const removeAt = argv.indexOf("--remove");
  if (removeAt !== -1) {
    // 실행하지 않는다. 사용자가 직접 쳐야 하는 명령으로만 보여준다.
    out.push(`\n제거하려면 직접 실행하세요:\n  /plugin uninstall ${argv[removeAt + 1]}`);
  }
  return { output: out.join("\n") };
}

/**
 * 적용 가능한 처방만 settings 에 쌓아 **한 번만** 쓴다. 충돌마다 파일을 쓰면 중간 실패가
 * 부분 적용으로 남는다. 수동 처방은 건너뛰되 무엇이 남았는지 출력에 남긴다 — 조용히 빠지면
 * 사용자는 doctor 가 전부 고쳤다고 믿는다.
 */
function apply({ visible, settings, writeSettings, appendLedger, at }) {
  const lines = [];
  const entries = [];
  let next = settings ?? {};

  for (const conflict of visible) {
    if (!conflict.remedy?.applicable) {
      lines.push(`건너뜀(수동): ${conflict.kind} — ${conflict.unit} → ${conflict.remedy?.manual ?? "자동 처방 없음"}`);
      continue;
    }
    const r = applyRemedy({ conflict, settings: next, now: at });
    next = r.settings;
    if (r.entry) entries.push(r.entry);
    lines.push(`적용: ${conflict.unit} → ${conflict.remedy.value}`);
  }

  if (entries.length) {
    writeSettings(next);
    for (const entry of entries) appendLedger(entry);
  }
  return lines.join("\n");
}

/**
 * 마지막 apply 를 되돌린다. **복원이 아니라 역편집이다** — 기록한 경로 하나만 본다.
 * 드리프트(경로가 그 사이 바뀜)면 아무것도 쓰지 않고 기대값과 실제값을 보여준다.
 */
function undo({ ledger, settings, writeSettings }) {
  const applies = (ledger ?? []).filter((e) => e?.type === "apply");
  const entry = applies[applies.length - 1];
  if (!entry) return "되돌릴 적용 기록이 없습니다.";

  const current = settings ?? {};
  const plan = planUndo({
    entry,
    currentFile: { hash: hashSettings(current), valueAt: (path) => valueAt(current, path) },
  });

  if (plan.action === "noop") return `이미 되돌려져 있습니다(${plan.reason}).`;
  if (plan.action === "stop") {
    return [
      "설정이 그 사이 바뀌어 멈췄습니다. 덮어쓰지 않았습니다.",
      `  기대: ${JSON.stringify(plan.expected)}`,
      `  실제: ${JSON.stringify(plan.actual)}`,
    ].join("\n");
  }

  writeSettings(setAt(current, entry.path, entry.before));
  return `되돌렸습니다(${plan.reason}): ${entry.path.join(".")}`;
}
