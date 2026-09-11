// 설치된 플러그인의 "충돌 표면" 인벤토리. doctor 판정의 입력이다.
//
// 충돌 표면이란 두 플러그인이 같은 이름을 쓰면 하나가 다른 하나를 가리는 지점을 말한다.
// MCP 서버명·에이전트명·bin 이름은 이름 공간이 하나뿐이라 섀도잉이 일어나고(실제 사고:
// ecc 의 chrome-devtools MCP 가 nereus 것을 가렸다), 훅은 같은 지점에 둘 다 붙어 순서가
// 불확실해진다. 스킬은 겹쳐도 라우팅만 흐려지므로 별도 큐레이션 표에서 다룬다.
//
// 활성 여부는 **디스크 존재가 아니라 settings.json 의 enabledPlugins 로만** 판단한다.
// 설치돼 있지만 꺼둔 플러그인은 충돌하지 않는데, 디스크를 보면 충돌로 오인한다.
//
// 모든 읽기는 실패를 삼키고 빈 값이 된다. 진단기가 진단 대상 때문에 죽으면 안 된다.
import fs from "node:fs";
import path from "node:path";

const EMPTY_SURFACES = { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null };

function defaultReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

function defaultReadDir(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

/** 설치 기록의 한 항목에서 installPath·version 을 꺼낸다. 배열이면 첫 항목이 현재 버전이다. */
function installRecord(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && typeof v === "object" ? v : {};
}

/** hooks.json 을 { event, matcher } 목록으로 편다. matcher 가 없으면 전체 대상이다. */
function hookPoints(hooksJson) {
  const events = hooksJson?.hooks;
  if (!events || typeof events !== "object") return [];
  const out = [];
  for (const [event, entries] of Object.entries(events)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) out.push({ event, matcher: entry?.matcher ?? "*" });
  }
  return out;
}

function surfacesOf(installPath, readJson, readDir) {
  if (!installPath) return { ...EMPTY_SURFACES };
  const mcpServers = readJson(path.join(installPath, ".mcp.json"))?.mcpServers;
  return {
    skills: readDir(path.join(installPath, "skills")),
    hooks: hookPoints(readJson(path.join(installPath, "hooks", "hooks.json"))),
    mcp: mcpServers && typeof mcpServers === "object" ? Object.keys(mcpServers) : [],
    // 에이전트는 파일 하나가 이름 하나다. reviewer.md → reviewer.
    agents: readDir(path.join(installPath, "agents")).map((f) => f.replace(/\.[^.]+$/, "")),
    bins: readDir(path.join(installPath, "bin")),
    mainAgent: readJson(path.join(installPath, "settings.json"))?.agent ?? null,
  };
}

/**
 * 설치된 플러그인을 표면까지 펼쳐 읽는다.
 * @param {object} o
 * @param {string} o.pluginsFile  installed_plugins.json 경로
 * @param {string} o.settingsFile enabledPlugins 를 가진 settings.json 경로
 * @param {(p: string) => any} [o.readJson]
 * @param {(p: string) => string[]} [o.readDir]
 * @returns {Array<{name, version, enabled, installPath, surfaces}>}
 */
export function readInventory({ pluginsFile, settingsFile, readJson = defaultReadJson, readDir = defaultReadDir }) {
  const installed = readJson(pluginsFile)?.plugins;
  if (!installed || typeof installed !== "object") return [];
  const enabledMap = readJson(settingsFile)?.enabledPlugins ?? {};

  return Object.entries(installed).map(([name, value]) => {
    const { installPath = null, version = null } = installRecord(value);
    return {
      name,
      version,
      enabled: enabledMap[name] === true,
      installPath,
      surfaces: surfacesOf(installPath, readJson, readDir),
    };
  });
}
