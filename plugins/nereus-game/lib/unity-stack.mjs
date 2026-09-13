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
// Unity 가 낸 first-party 플러그인(스킬 29개 + Unity CLI + Unity MCP).
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

  // user 스코프는 Unity 가 아닌 저장소에서도 스킬 29개가 상시 로딩된다. 토큰 예산 손해다.
  const advice = entry.scope === "user" ? ["scope-user"] : [];
  return { ...base, status: "ready", delegate: true, advice };
}

// 실행 진입점. 인자 없이 부르면 공식 플러그인 상태를 JSON 으로 낸다.
// process.exit(0) 을 부르지 않는다 — 파이프 stdout 이 잘린다.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(JSON.stringify(detectUnityAgentPlugin()) + "\n");
}
