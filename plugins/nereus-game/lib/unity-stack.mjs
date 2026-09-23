// Unity(2D 폰게임 포함) 프로젝트의 스택·테스트러너 판정.
//
// 코어의 확장 선언(marker/runnerMarker)은 **파일 존재만** 본다. 여기서는 매니페스트 내용까지 읽어
// 테스트 프레임워크가 실제로 들어 있는지 확인한다 — 프레임워크 없이 러너를 돌려주면
// TDD 게이트가 매번 실패하고, 그러면 게이트를 꺼버리게 된다.
import fs from "node:fs";
import path from "node:path";

const defaultFs = {
  exists: (p) => fs.existsSync(p),
  readFile: (p) => fs.readFileSync(p, "utf8"),
};

const UNITY_MARKER = "ProjectSettings/ProjectVersion.txt";
const UNITY_MANIFEST = "Packages/manifest.json";
const TEST_PACKAGE = "com.unity.test-framework";

// 내부 전용. 밖에서 쓰는 곳이 생기기 전에는 export 하지 않는다 —
// 이번 사이클에 "선언했는데 아무도 안 쓰는 것"으로 세 번 물렸다.
function isUnityProject(cwd, fsx = defaultFs) {
  return fsx.exists(path.join(cwd, UNITY_MARKER));
}

/** @returns {{ runner: string, command: string } | null} */
export function detectUnityRunner(cwd, fsx = defaultFs) {
  if (!isUnityProject(cwd, fsx)) return null;
  const manifestPath = path.join(cwd, UNITY_MANIFEST);
  if (!fsx.exists(manifestPath)) return null;
  let deps;
  try {
    deps = JSON.parse(fsx.readFile(manifestPath))?.dependencies;
  } catch {
    // 매니페스트를 못 읽으면 러너가 있다고 단정하지 않는다.
    // 한계: 깨진 매니페스트와 "테스트 프레임워크 없음"이 구분되지 않아 TDD 게이트가 조용히 꺼진다.
    // 훅에는 경고 채널이 없어 여기서 알릴 방법이 없다 — unity 스킬이 이 경우를 점검 항목으로 다룬다.
    return null;
  }
  if (!deps || !deps[TEST_PACKAGE]) return null;
  return { runner: "unity-test-framework", command: "Unity -runTests -batchmode -nographics -quit" };
}

// ── Unity 공식 Claude Code 플러그인 판정 ────────────────────────────────
//
// Unity 가 낸 first-party 플러그인(스킬 31개. CLI·MCP 는 싣지 않는다 — detectUnityEditorLink 가 따로 본다).
// 엔진 API 절차는 엔진과 함께 낡으므로 우리가 들고 있지 않고 **위임**한다.
// 그러려면 먼저 설치·활성 여부를 알아야 한다.
//
// 코어 `plugin-inventory.mjs` 를 import 하지 않는다. 확장이 코어 내부에 붙으면
// 코어가 바뀔 때 확장이 조용히 깨진다 — 확장은 데이터와 자기 lib 안에서 끝난다.
const UNITY_PLUGIN = "unity@unity-agent-plugin";

const homeJson = (rel) =>
  path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude", rel);

function readJsonFile(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

/**
 * Unity 공식 플러그인의 상태.
 *
 * **미설치와 확인 불가를 구분한다.** 인벤토리를 못 읽었을 때 `absent` 를 돌려주면
 * 설치돼 있는데도 위임하지 않게 되고 그 사실이 어디에도 안 남는다.
 *
 * 활성 여부는 디스크 존재가 아니라 `settings.json` 의 `enabledPlugins` 가 진실이다.
 * 설정이 아예 없으면 끈 적이 없다는 뜻이므로 활성으로 본다.
 *
 * @returns {{ status: "ready"|"disabled"|"absent"|"unknown", delegate: boolean,
 *             version?: string, scope?: string, advice?: string[], why?: string }}
 */
export function detectUnityAgentPlugin(opts = {}) {
  const {
    pluginsFile = homeJson("plugins/installed_plugins.json"),
    settingsFile = homeJson("settings.json"),
    readJson = readJsonFile,
  } = opts;

  const inventory = readJson(pluginsFile);
  if (!inventory?.plugins) {
    return { status: "unknown", delegate: false, why: `설치 인벤토리를 읽을 수 없다: ${pluginsFile}` };
  }

  const entry = inventory.plugins[UNITY_PLUGIN]?.[0];
  if (!entry) return { status: "absent", delegate: false };

  const enabled = readJson(settingsFile)?.enabledPlugins?.[UNITY_PLUGIN];
  const base = { version: entry.version, scope: entry.scope };
  if (enabled === false) return { ...base, status: "disabled", delegate: false };

  // user 스코프는 Unity 가 아닌 저장소에서도 스킬 31개가 상시 로딩된다. 토큰 예산 손해다.
  const advice = entry.scope === "user" ? ["scope-user"] : [];
  return { ...base, status: "ready", delegate: true, advice };
}

// ── 에디터 실시간 제어 판정 ────────────────────────────────────────────
//
// 공식 플러그인은 스킬 문서만 싣는다. 열린 에디터를 직접 조작하려면 세 가지가 따로 필요하다:
//   cli      — `unity` 명령 (Unity CLI, 플러그인과 별개 설치)
//   pipeline — 프로젝트 매니페스트의 `com.unity.pipeline` (에디터 쪽 수신부)
//   mcp      — `unity mcp` 를 띄우는 MCP 서버 등록 (선택 — 없어도 CLI 로 제어된다)
// 플러그인이 ready 라고 이 셋이 있는 것이 아니다. 섞어 판정하면 없는 통로로 씬을 고치려 든다.
const PIPELINE_PACKAGE = "com.unity.pipeline";

function findUnityCli() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const exe = process.platform === "win32" ? "unity.exe" : "unity";
  const dirs = [...(process.env.PATH || "").split(path.delimiter), path.join(home, ".unity", "bin")];
  for (const d of dirs) {
    if (!d) continue;
    const p = path.join(d, exe);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// command 가 unity 바이너리이고 첫 인자가 mcp 인 서버만 인정한다 — 이름만 비슷한 서버를 걸러낸다.
function isUnityMcp(server) {
  const cmd = path.basename(String(server?.command || "")).replace(/\.exe$/i, "");
  return cmd === "unity" && Array.isArray(server?.args) && server.args[0] === "mcp";
}

function hasUnityMcp(cwd, readJson, claudeJson) {
  const user = readJson(claudeJson);
  const pools = [
    readJson(path.join(cwd, ".mcp.json"))?.mcpServers,
    user?.mcpServers,
    user?.projects?.[cwd]?.mcpServers,
  ];
  return pools.some((servers) => servers && Object.values(servers).some(isUnityMcp));
}

/**
 * @returns {null | { status: "ready"|"partial"|"absent"|"unknown", live: boolean,
 *                    missing: string[], cli?: string, why?: string }}
 *   live — CLI 와 pipeline 이 둘 다 있어 열린 에디터를 조작할 수 있다.
 */
export function detectUnityEditorLink(cwd, opts = {}) {
  const {
    findCli = findUnityCli,
    readJson = readJsonFile,
    exists = (p) => fs.existsSync(p),
    claudeJson = path.join(process.env.HOME || process.env.USERPROFILE || "", ".claude.json"),
  } = opts;
  if (!exists(path.join(cwd, UNITY_MARKER))) return null;

  const cli = findCli();
  const manifest = readJson(path.join(cwd, UNITY_MANIFEST));
  const pipeline = Boolean(manifest?.dependencies?.[PIPELINE_PACKAGE]);
  const mcp = hasUnityMcp(cwd, readJson, claudeJson);

  const missing = [];
  if (!cli) missing.push("cli");
  if (!pipeline) missing.push("pipeline");
  if (!mcp) missing.push("mcp");

  const base = { live: Boolean(cli && pipeline), missing, ...(cli ? { cli } : {}) };
  // 매니페스트를 못 읽으면 "pipeline 없음"과 구분되지 않는다. 없다고 단정하지 않는다.
  if (!manifest) return { ...base, status: "unknown", why: `manifest 를 읽을 수 없다: ${UNITY_MANIFEST}` };
  const status = missing.length === 0 ? "ready" : missing.length === 3 ? "absent" : "partial";
  return { ...base, status };
}

// 실행 진입점. 인자 없이 부르면 공식 플러그인 상태를 JSON 으로 낸다.
// Unity 프로젝트 안에서 부르면 `editor` 에 실시간 제어 판정이 붙는다(기존 필드는 그대로).
// process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 잘린다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const editor = detectUnityEditorLink(process.cwd());
  const out = { ...detectUnityAgentPlugin(), ...(editor ? { editor } : {}) };
  process.stdout.write(JSON.stringify(out) + "\n");
}
