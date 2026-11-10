// 문서↔코드 드리프트의 기계 판정. 문서가 가리키는 경로·심볼이 아직 존재하는지만 본다.
// "설계대로 동작하는가"(의미 드리프트)는 SKILL.md 절차대로 에이전트가 본다 — 이건 그 앞의 싼 거름망이다.
// 출처: google/elephant-goldfish-model (Apache-2.0) skills/egm-drift-report 의
//       "문서가 특정 객체·필드·파일 이름을 말하는데 코드에 없으면 보고 대상" 규칙을 코드로 옮겼다.
// 사용: node drift.mjs <문서 또는 디렉터리>...   출력은 JSON, 보고용이라 항상 종료코드 0.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FENCE_RE = /```[\s\S]*?```/g;
const TICK_RE = /`([^`\n]+)`/g;
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const CALL_RE = /^(?:[A-Za-z_$][\w$]*\.)*([A-Za-z_$][\w$]*)\(.*\)$/;
const EXT_RE = /\.[A-Za-z0-9]{1,8}$/;
const SKIP_DIRS = new Set(["node_modules", ".git"]);

const stripLocation = (p) => p.replace(/#.*$/, "").replace(/:\d+(-\d+)?$/, "");

// 슬래시가 있다고 경로가 아니다(`CRITICAL/HIGH`). 확장자·상대 접두·끝 슬래시·두 단계 이상일 때만 경로로 본다.
const looksLikePath = (t) => {
  if (/[\s$*<>(){}~]/.test(t) || SCHEME_RE.test(t) || !t.includes("/")) return false;
  return EXT_RE.test(t) || /^\.\.?\//.test(t) || t.endsWith("/") || t.split("/").length > 2;
};

export function extractRefs(md) {
  const body = String(md).replace(FENCE_RE, " ");
  const paths = [];
  const symbols = [];
  for (const [, tok] of body.matchAll(TICK_RE)) {
    const t = tok.trim();
    const call = t.match(CALL_RE);
    if (call) { symbols.push(call[1]); continue; }
    const p = stripLocation(t);
    if (looksLikePath(p)) paths.push(p);
  }
  for (const [, raw] of body.matchAll(LINK_RE)) {
    if (raw.startsWith("#") || SCHEME_RE.test(raw)) continue;
    const p = stripLocation(raw);
    if (p) paths.push(p);
  }
  return { paths: [...new Set(paths)], symbols: [...new Set(symbols)] };
}

// 스펙은 플러그인 루트 기준 경로(`skills/x/SKILL.md`)를 자주 쓴다. 저장소 파일 중 접미사가 맞는 것이 있으면 존재로 친다.
const matchesSuffix = (p, files) => {
  const s = p.replace(/^\.\//, "");
  if (s.startsWith("../")) return false;
  return s.endsWith("/")
    ? files.some((f) => f.startsWith(s) || f.includes(`/${s}`))
    : files.some((f) => f === s || f.endsWith(`/${s}`));
};

const pathExists = (p, { docDir, cwd, exists, files }) => {
  if (path.isAbsolute(p)) return exists(p);
  return exists(path.resolve(docDir, p)) || exists(path.resolve(cwd, p)) || matchesSuffix(p, files);
};

export function checkRefs(refs, { docDir, cwd, exists = fs.existsSync, hasSymbol = () => null, files = [] }) {
  const missingPaths = refs.paths.filter((p) => !pathExists(p, { docDir, cwd, exists, files }));
  const found = refs.symbols.map((s) => [s, hasSymbol(s)]);
  return {
    missingPaths,
    missingSymbols: found.filter(([, v]) => v === false).map(([s]) => s),
    uncheckedSymbols: found.filter(([, v]) => v === null).map(([s]) => s),
  };
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .sort((a, b) => a.name.localeCompare(b.name))
  .flatMap((e) => {
    if (SKIP_DIRS.has(e.name)) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith(".md") ? [p] : [];
  });

export function listDocs(target) {
  if (!fs.existsSync(target)) throw new Error(`대상이 없다: ${target}`);
  return fs.statSync(target).isFile() ? [target] : walk(target);
}

// 문서는 검색 대상에서 뺀다 — 문서가 자기 이름을 말하는 것은 코드가 있다는 증거가 아니다.
// 0=찾음, 1=없음, 그 밖(저장소 아님 등)=모름. 모름을 없음으로 치지 않는다.
const gitGrepSymbol = (cwd) => (name) => {
  const r = spawnSync("git", ["grep", "-q", "-w", "-F", "--untracked", "-e", name, "--", ".", ":(exclude)*.md"], { cwd, stdio: "ignore" });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  return null;
};

// 추적 파일 + 무시되지 않은 새 파일. 저장소가 아니면 빈 목록 — 접미사 판정만 꺼지고 나머지는 돈다.
const gitFiles = (cwd) => {
  const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : [];
};

export function driftReport(targets, { cwd = process.cwd(), exists = fs.existsSync, hasSymbol = gitGrepSymbol(cwd), files = gitFiles(cwd) } = {}) {
  const docs = targets.flatMap((t) => listDocs(path.resolve(cwd, t))).map((doc) => {
    const refs = extractRefs(fs.readFileSync(doc, "utf8"));
    const res = checkRefs(refs, { docDir: path.dirname(doc), cwd, exists, hasSymbol, files });
    return { doc: path.relative(cwd, doc), refs: { paths: refs.paths.length, symbols: refs.symbols.length }, ...res };
  });
  const withDrift = docs.filter((d) => d.missingPaths.length || d.missingSymbols.length).length;
  return { docs, summary: { docs: docs.length, withDrift } };
}

if (process.argv[1] && /drift\.mjs$/.test(process.argv[1])) {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    process.stderr.write("사용: drift.mjs <문서 또는 디렉터리>...\n");
    process.exit(2);
  }
  try {
    process.stdout.write(JSON.stringify(driftReport(targets), null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`drift: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
