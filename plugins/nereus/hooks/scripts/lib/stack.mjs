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

export function isTestFile(file) {
  const f = file.replace(/\\/g, "/");
  return TEST_PATTERNS.some((re) => re.test(f));
}

export function isSourceFile(file) {
  const f = file.replace(/\\/g, "/");
  if (!SOURCE_EXT.test(f)) return false;
  if (NON_SOURCE.some((re) => re.test(f))) return false;
  return true;
}
