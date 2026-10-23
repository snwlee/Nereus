// 연결 검사. "만들었다"와 "연결했다"는 다르다 — 둘 다 실제로 한 번씩 놓쳐서 생긴 검사다.
//  - unwired: 새 실행 스크립트가 SKILL.md·hooks.json·다른 스크립트 어디에서도 호출되지 않는다.
//             테스트만 통과하는 죽은 코드를 커밋한 auto-clear 사고가 이 형태였다.
// 순수 함수. 파일 접근은 호출자가 주입한다.

const SCRIPT_EXT = /\.(mjs|js|sh|py)$/;
const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\//;
// 스킬·훅이 실제로 실행하는 자리. lib/ 는 다른 스크립트가 import 하는 공유 모듈이라 제외한다.
const ENTRY_PATH = /(^|\/)(skills\/[^/]+\/scripts|hooks\/scripts)\/[^/]+$/;


export function isEntryScript(file) {
  return SCRIPT_EXT.test(file) && !TEST_PATH.test(file) && ENTRY_PATH.test(file);
}

// 파일명이 어딘가에 등장하면 연결된 것으로 본다. 자기 자신과 테스트는 참조로 치지 않는다 —
// 테스트가 import 하는 것은 "쓰인다"가 아니라 "검증된다"일 뿐이다.
export function findOrphans({ scripts, refs }) {
  const findings = [];
  for (const file of scripts) {
    const name = file.split("/").pop();
    const wired = refs.some((r) => r.file !== file && !TEST_PATH.test(r.file) && r.text.includes(name));
    if (!wired) findings.push({ category: "unwired", file, message: `${name} 을 호출하는 곳이 없다 (SKILL.md·hooks.json·다른 스크립트에 연결하거나 삭제)` });
  }
  return findings;
}

// files: parseDiff 결과. listRefs(): 참조 후보 [{file, text}] — 호출자가 저장소를 읽어 넘긴다.
export function checkWiring({ files, listRefs }) {
  // 제거된 라인이 없는 실행 스크립트만 신규로 본다. 기존 스크립트는 이미 참조가 있어 어차피 걸리지 않는다.
  const scripts = files.filter((f) => isEntryScript(f.file) && f.removed.length === 0).map((f) => f.file);
  const findings = scripts.length ? findOrphans({ scripts, refs: listRefs() }) : [];
  return { pass: findings.length === 0, findings };
}
