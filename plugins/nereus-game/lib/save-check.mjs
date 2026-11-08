// 세이브 계획 검사기. 세이브 소실은 되돌릴 수 없다 — 패치 하나가 모든 기존 세이브를 못 읽게 만들거나,
// 저장 중 크래시 하나가 진행도를 잘린 파일로 바꾼다. 둘 다 출시 뒤에 드러난다.
//
// 규칙은 awesome-gamedev-agent-skills 의 disciplines/save-systems(versioning-and-migration.md)에서 왔다 —
// Copyright 2026 Abhishek Barali and contributors, Apache-2.0. 체크리스트를 판정 함수로 다시 썼다.
import { readCliInput, runCli } from "./cli-input.mjs";

const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
const missingFrom = (list, wanted) => {
  const have = new Set(Array.isArray(list) ? list : []);
  return wanted.filter((v) => !have.has(v));
};

function versionViolations(plan) {
  const v = plan.currentVersion;
  if (!Number.isInteger(v) || v < 1) {
    return [{ code: "no-version", why: "버전 필드 없이 패치를 내면 기존 세이브가 어느 모양인지 추측해야 한다" }];
  }
  const out = [];
  const gap = missingFrom(plan.migrations, range(1, v - 1));
  if (gap.length) out.push({ code: "migration-gap", missing: gap, why: "vN→vN+1 단계가 하나라도 빠지면 그 이전 세이브가 전부 고립된다" });
  const fixtures = missingFrom(plan.fixtures, Array.isArray(plan.shippedVersions) ? plan.shippedVersions : range(1, v));
  if (fixtures.length) out.push({ code: "fixture-gap", missing: fixtures, why: "출시한 버전마다 실제 세이브 표본이 있어야 마이그레이션 회귀를 잡는다" });
  return out;
}

export function checkSave(plan = {}) {
  const violations = versionViolations(plan);
  if (plan.write !== "atomic-rename") {
    violations.push({ code: "in-place-write", why: "제자리 쓰기 중 크래시는 잘린 파일을 남긴다. 임시 파일에 쓰고 교체한다" });
  }
  if (plan.backup !== true) {
    violations.push({ code: "no-backup", why: "주 파일을 못 읽으면 돌아갈 마지막 정상본이 있어야 한다" });
  }
  if (plan.autosave && plan.autosave.separateSlot !== true) {
    violations.push({ code: "autosave-clobber", why: "자동저장이 수동 슬롯을 덮으면 플레이어가 고른 지점이 사라진다" });
  }
  if (plan.newerVersion !== "refuse") {
    violations.push({ code: "newer-not-refused", why: "더 새 빌드의 세이브를 추측으로 읽으면 모르는 필드를 버린 채 덮어쓴다" });
  }
  const derived = (Array.isArray(plan.fields) ? plan.fields : []).filter((f) => f?.derived === true).map((f) => f.name);
  if (derived.length) {
    violations.push({ code: "derived-stored", fields: derived, why: "파생 값을 저장하면 공식이 바뀐 패치에서 저장값과 계산값이 어긋난다" });
  }
  return { violations };
}

// 실행 진입점. stdin 으로 { plan } 을 받아 결과를 JSON 으로 낸다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(checkSave(readCliInput().plan)) + "\n");
  });
}
