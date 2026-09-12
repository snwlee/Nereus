// 스택·테스트 러너 판별. 파일시스템은 주입 가능.
import fs from "node:fs";
import path from "node:path";

const defaultFs = {
  exists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, "utf8"),
};

function readOr(fsx, p, fallback = "") {
  try { return fsx.readFile(p); } catch { return fallback; }
}

// 확장 스택은 코어 판정 뒤에 붙는다. 코어가 아는 스택이 항상 앞이다.
// extraStacks 항목: { name, marker, ... } — 형제 플러그인의 nereus-extension.json 에서 온다.
export function detectStack(cwd, fsx = defaultFs, { extraStacks = [] } = {}) {
  const has = (f) => fsx.exists(path.join(cwd, f));
  const out = [];
  if (has("pubspec.yaml")) out.push("flutter");
  if (has("build.gradle") || has("build.gradle.kts") || has("pom.xml")) out.push("spring");
  if (has("package.json")) out.push("node");
  for (const s of extraStacks) {
    if (s?.name && s?.marker && has(s.marker) && !out.includes(s.name)) out.push(s.name);
  }
  return out;
}

// 코어 러너를 찾지 못했을 때만 확장 선언을 본다. 코어가 아는 스택이 항상 이긴다.
// 확장 항목은 marker(스택 마커)와 runnerMarker(러너 설정 파일)를 둘 다 만족해야 러너로 인정된다 —
// 러너 설정이 없는데 명령을 돌려주면 TDD 게이트가 매번 실패하고, 그러면 게이트를 꺼버리게 된다.
export function detectTestRunner(cwd, fsx = defaultFs, { extraStacks = [] } = {}) {
  const core = coreTestRunner(cwd, fsx);
  if (core) return core;
  const has = (f) => fsx.exists(path.join(cwd, f));
  for (const s of extraStacks) {
    if (!s?.marker || !s?.runnerMarker || !s?.runner || !s?.command) continue;
    if (has(s.marker) && has(s.runnerMarker)) return { runner: s.runner, command: s.command };
  }
  return null;
}

function coreTestRunner(cwd, fsx) {
  const has = (f) => fsx.exists(path.join(cwd, f));
  if (has("pubspec.yaml")) {
    const pub = readOr(fsx, path.join(cwd, "pubspec.yaml"));
    return /flutter_test|^\s*test:/m.test(pub) ? { runner: "flutter_test", command: "flutter test" } : null;
  }
  if (has("gradlew") || has("build.gradle") || has("build.gradle.kts")) return { runner: "gradle", command: "./gradlew test" };
  if (has("pom.xml")) return { runner: "maven", command: "mvn test" };
  if (has("package.json")) {
    let pkg = {};
    try { pkg = JSON.parse(readOr(fsx, path.join(cwd, "package.json"), "{}")); } catch { pkg = {}; }
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return { runner: "npm", command: "npm test" };
    if (["vitest.config.ts", "vitest.config.js", "vitest.config.mts"].some(has)) return { runner: "vitest", command: "npx vitest run" };
    if (["jest.config.js", "jest.config.ts", "jest.config.cjs", "jest.config.mjs"].some(has)) return { runner: "jest", command: "npx jest" };
    return null;
  }
  return null;
}

const TEST_PATTERNS = [
  /(^|[\\/])test[\\/]/, /(^|[\\/])tests[\\/]/, /(^|[\\/])__tests__[\\/]/, /(^|[\\/])src[\\/]test[\\/]/,
  /_test\.dart$/, /Test\.(java|kt)$/, /Tests\.(java|kt)$/, /\.(test|spec)\.[cm]?[jt]sx?$/,
];
const SOURCE_EXT = /\.(dart|java|kt|ts|tsx|js|jsx|mjs|cjs)$/;
const NON_SOURCE = [/(^|[\\/])migrations?[\\/]/, /\.d\.ts$/, /\.g\.dart$/, /\.freezed\.dart$/, /(^|[\\/])generated[\\/]/];

// 코어는 게임·모바일 같은 도메인의 확장자를 모른다. 로블록스(.luau)·유니티(.cs) 를 여기 박으면
// 스택이 늘 때마다 코어를 고쳐야 하고, 그것은 확장점을 둔 이유를 무너뜨린다.
// 그래서 **확장 스택 선언이 데이터로 준다**(sourceExt / testRe). 인자는 선택이고 기본값은 기존 동작이다.
//
// 이것이 빠져 있어서 로블록스·유니티 프로젝트에서는 tdd-guard 도 tdd-gate 도 "소스가 아님"으로 빠져
// TDD 강제가 한 번도 발동할 수 없었다 (2026-09-12, 실제 리그에서 발견).
function compile(patterns) {
  const out = [];
  for (const p of Array.isArray(patterns) ? patterns : []) {
    if (!p) continue; // 빈 패턴은 의미가 없다
    try { out.push(p instanceof RegExp ? p : new RegExp(p)); } catch { /* 못 고치고 버린다 */ }
  }
  return out;
}

/**
 * 확장 스택 선언들에서 파일 인식 규칙을 모은다. 선언하지 않은 스택은 조용히 건너뛴다.
 *
 * `cwd` 를 주면 **이 프로젝트에 실제로 있는 스택으로 좁힌다**. 좁히지 않으면 설치만 해 둔
 * 다른 스택의 테스트 패턴까지 인정돼, 동명 타 언어 테스트가 TDD 게이트를 통과시킬 수 있다
 * (codex 2차 의견 HIGH). 범위를 주지 않으면 전부 합친다 — 기존 호출부 계약은 그대로다.
 *
 * 빈 문자열은 버린다. `endsWith("")` 는 모든 경로에 맞아 확장 선언 하나가 전부를 소스로 만든다.
 */
export function stackFileRules(stacks, { cwd, fsx = defaultFs } = {}) {
  const list = Array.isArray(stacks) ? stacks : [];
  const scoped = cwd === undefined ? list : list.filter((st) => st?.marker && fsx.exists(path.join(cwd, st.marker)));
  const extraExt = [];
  const extraTestRe = [];
  for (const st of scoped) {
    for (const e of Array.isArray(st?.sourceExt) ? st.sourceExt : []) if (typeof e === "string" && e && !extraExt.includes(e)) extraExt.push(e);
    for (const r of Array.isArray(st?.testRe) ? st.testRe : []) if (typeof r === "string" && r && !extraTestRe.includes(r)) extraTestRe.push(r);
  }
  return { extraExt, extraTestRe };
}

export function isTestFile(file, { extraTestRe = [] } = {}) {
  const f = file.replace(/\\/g, "/");
  if (TEST_PATTERNS.some((re) => re.test(f))) return true;
  return compile(extraTestRe).some((re) => re.test(f));
}

export function isSourceFile(file, { extraExt = [] } = {}) {
  const f = file.replace(/\\/g, "/");
  const known = SOURCE_EXT.test(f) || extraExt.some((e) => typeof e === "string" && e.length > 0 && f.toLowerCase().endsWith(e.toLowerCase()));
  if (!known) return false;
  if (NON_SOURCE.some((re) => re.test(f))) return false;
  return true;
}
