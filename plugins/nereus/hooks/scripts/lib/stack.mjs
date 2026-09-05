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

export function detectStack(cwd, fsx = defaultFs) {
  const has = (f) => fsx.exists(path.join(cwd, f));
  const out = [];
  if (has("pubspec.yaml")) out.push("flutter");
  if (has("build.gradle") || has("build.gradle.kts") || has("pom.xml")) out.push("spring");
  if (has("package.json")) out.push("node");
  return out;
}

export function detectTestRunner(cwd, fsx = defaultFs) {
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
