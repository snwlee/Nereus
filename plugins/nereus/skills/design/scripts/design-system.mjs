// 디자인 방향 생성기. ui-ux-pro-max 의 search.py --design-system 을 호출해 후보 디자인 시스템
// (스타일·팔레트·타이포 페어링·안티패턴·체크리스트)을 docs/design/<slug>-system.md 로 쓴다.
// 그 파일이 그대로 design-feedback.mjs direction --brief 의 입력이 된다.
//
// 상류를 포함하지 않고 래퍼로만 호출한다(Ruling: 외부 도구는 래퍼로 호출).
// 데이터 엔진으로만 설치하므로 상시 컨텍스트 비용이 없고 nereus:design 과 트리거가 겹치지 않는다.
//
// 사용:
//   node design-system.mjs "developer harness dashboard" --project-name Nereus --variance 7
//   node design-system.mjs "결제 완료 히어로" --stack nextjs --density 3 --print
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { run } from "../../../hooks/scripts/lib/exec.mjs";
import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";

const ENTRY = path.join("scripts", "search.py");
const DIALS = ["variance", "motion", "density"];

// 탐색 순서: 명시 환경변수 → nereus 전용 sparse clone → 전역 스킬 → 프로젝트 스킬.
export function ENGINE_CANDIDATES({ env = process.env, home = os.homedir(), cwd = process.cwd() } = {}) {
  const skill = (base) => path.join(base, ".claude", "skills", "ui-ux-pro-max");
  return [
    env.NEREUS_UIUX_HOME || null,
    skill(path.join(home, ".local", "share", "nereus", "ui-ux-pro-max")),
    path.join(home, ".claude", "skills", "ui-ux-pro-max"),
    skill(cwd),
  ].filter(Boolean);
}

export function resolveEngine({ env = process.env, home = os.homedir(), cwd = process.cwd(), exists } = {}) {
  const has = exists ?? ((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  for (const root of ENGINE_CANDIDATES({ env, home, cwd })) {
    const script = path.join(root, ENTRY);
    if (has(script)) return { root, script };
  }
  return null;
}

function dial(name, value) {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error(`${name} 는 1~10 정수여야 한다 (받은 값: ${value})`);
  }
  return [`--${name}`, String(value)];
}

export function buildArgs({ query, projectName, stack, variance, motion, density } = {}) {
  if (!query || !String(query).trim()) throw new Error("query 가 비어 있다 — 무엇을 위한 디자인인지 한 줄로 적는다");
  // --format markdown 이면 출력이 그대로 브리프가 되므로 ANSI 박스 파싱이 필요 없다.
  const args = [String(query).trim(), "--design-system", "--format", "markdown"];
  if (projectName) args.push("--project-name", String(projectName));
  if (stack) args.push("--stack", String(stack));
  // --persist 는 쓰지 않는다: 엔진이 저장소에 직접 쓰는 대신 stdout 만 받아 우리가 쓴다.
  for (const [name, value] of [["variance", variance], ["motion", motion], ["density", density]]) {
    if (value === undefined || value === null) continue;
    args.push(...dial(name, value));
  }
  return args;
}

export function slugify(name, fallback = "design") {
  const slug = String(name ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function briefPath({ cwd = process.cwd(), slug = "design" } = {}) {
  return path.join(cwd, "docs", "design", `${slug}-system.md`);
}

export function missingEngineNotice() {
  return [
    "디자인 방향 생성기(ui-ux-pro-max)가 없다. 0단계를 건너뛰려면 브리프를 직접 쓴다 —",
    "단 '깔끔하고 미니멀' 같은 무색 기본값은 direction 라운드에서 그대로 반려된다.",
    "",
    "설치(데이터 엔진으로만, 상시 컨텍스트 비용 0):",
    "  mkdir -p ~/.local/share/nereus && cd ~/.local/share/nereus \\",
    "    && git clone --depth 1 --filter=blob:none --sparse \\",
    "       https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ui-ux-pro-max \\",
    "    && cd ui-ux-pro-max && git sparse-checkout set .claude/skills/ui-ux-pro-max",
    "",
    "다른 경로에 이미 있으면: export NEREUS_UIUX_HOME=<그 스킬 디렉터리>",
    '이 단계를 끄려면: .nereus/config.json 에 { "design": { "systemGenerator": "none" } }',
  ].join("\n");
}

export function planGenerate({ query, projectName, stack, variance, motion, density, cwd = process.cwd(), engine } = {}) {
  if (!engine) return { ok: false, notice: missingEngineNotice() };
  const args = buildArgs({ query, projectName, stack, variance, motion, density });
  return {
    ok: true,
    cmd: "python3",
    // cwd 를 엔진 루트로 두면 search.py 가 data/ 를 상대 경로로 찾는다.
    args: [engine.script, ...args],
    cwd: engine.root,
    out: briefPath({ cwd, slug: slugify(projectName || query) }),
  };
}

function parseCli(argv) {
  const opts = { print: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--print") { opts.print = true; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[++i];
      opts[key] = DIALS.includes(key) ? Number(value) : value;
      continue;
    }
    rest.push(a);
  }
  if (!opts.query && rest.length) opts.query = rest.join(" ");
  return opts;
}

function main() {
  const cwd = process.cwd();
  const cfg = loadConfig({ cwd });
  const generator = cfg.design?.systemGenerator ?? "ui-ux-pro-max";
  if (generator === "none") {
    process.stdout.write("design.systemGenerator=none — 0단계(방향 생성)를 건너뛴다. 브리프를 직접 쓴다.\n");
    return 0;
  }

  const opts = parseCli(process.argv.slice(2));
  let plan;
  try {
    plan = planGenerate({ ...opts, cwd, engine: resolveEngine({ cwd }) });
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    return 2;
  }
  if (!plan.ok) {
    process.stderr.write(plan.notice + "\n");
    return 3;
  }

  const r = run(plan.cmd, plan.args, { cwd: plan.cwd, timeoutMs: 120000 });
  if (!r.ok || !r.stdout.trim()) {
    process.stderr.write(`생성기 실행 실패 (status ${r.status})\n${r.stderr || r.stdout}\n`);
    return 4;
  }

  fs.mkdirSync(path.dirname(plan.out), { recursive: true });
  fs.writeFileSync(plan.out, r.stdout, "utf8");
  if (opts.print) process.stdout.write(r.stdout);
  process.stdout.write(
    [
      "",
      `방향 후보를 썼다: ${path.relative(cwd, plan.out)}`,
      "",
      "이 파일은 **후보**다. 그대로 구현하지 않는다. 다음:",
      `  node "\${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/design-feedback.mjs" direction --brief ${path.relative(cwd, plan.out)}`,
      "REVISE 를 받으면 이 파일을 직접 고치거나 다이얼(--variance/--motion/--density)을 바꿔 다시 생성한다.",
      "",
    ].join("\n"),
  );
  return 0;
}

if (process.argv[1] && /design-system\.mjs$/.test(process.argv[1])) process.exit(main());
