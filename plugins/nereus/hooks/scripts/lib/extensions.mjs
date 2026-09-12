// 형제 플러그인 확장 로더.
//
// 코어는 게임·모바일 같은 도메인을 모른다. 그 지식은 별도 플러그인에 두고, 여기서 "데이터만" 받는다.
// 코드를 import() 하지 않는 이유가 둘 있다: (1) 형제 플러그인의 런타임 오류가 코어 훅을 죽이면 안 된다,
// (2) 훅은 5~10초 타임아웃 안에 끝나야 해서 임의 모듈 평가를 감당할 수 없다.
//
// **설치 경로와 활성 여부는 서로 다른 파일에 있다.** installPath 는
// `~/.claude/plugins/installed_plugins.json` 의 설치기록에, 활성 여부는 `~/.claude/settings.json` 의
// `enabledPlugins`(불리언 맵)에 있다. 둘을 합치는 일은 lib/plugin-inventory.mjs 의 readInventory 가
// 이미 한다 — 여기서 다시 만들지 않고 그 출력을 받는다.
// (리뷰 H2: 초판은 enabledPlugins 가 installPath 를 갖는다고 가정했고, 그 형태는 존재하지 않는다.)
//
// 모든 읽기는 실패를 삼킨다. 확장이 코어를 죽이면 안 된다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readInventory } from "./plugin-inventory.mjs";

const EXTENSION_FILE = "nereus-extension.json";

function defaultReadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** 라우트 한 건을 정규화한다. 정규식이 컴파일되지 않으면 버린다(추측해 고치지 않는다). */
function toRoute(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { skill, why, re } = raw;
  if (typeof skill !== "string" || typeof why !== "string" || typeof re !== "string") return null;
  try {
    return { skill, why, re: new RegExp(re, "i") };
  } catch {
    return null;
  }
}

function toStack(raw) {
  if (!raw || typeof raw !== "object") return null;
  return typeof raw.name === "string" && typeof raw.marker === "string" ? { ...raw } : null;
}

/**
 * 활성 플러그인들의 확장 선언을 모은다.
 *
 * `records` 를 직접 주면 그것을 쓰고(테스트·재사용), 없으면 `pluginsFile`/`settingsFile` 로
 * readInventory 를 돌린다. 둘 다 없으면 사용자 홈의 기본 경로를 쓴다.
 *
 * @returns {{ routes: Array<{skill: string, why: string, re: RegExp}>, stacks: Array<object> }}
 */
export function loadExtensions({ readJson = defaultReadJson, records, pluginsFile, settingsFile, home } = {}) {
  const list = records ?? inventoryOf({ readJson, pluginsFile, settingsFile, home });
  const routes = [];
  const stacks = [];
  for (const rec of Array.isArray(list) ? list : []) {
    if (!rec?.enabled || typeof rec.installPath !== "string" || !rec.installPath) continue;
    let decl;
    try {
      decl = readJson(path.join(rec.installPath, EXTENSION_FILE));
    } catch {
      continue; // 이 플러그인만 건너뛴다
    }
    if (!decl || typeof decl !== "object") continue;
    for (const raw of Array.isArray(decl.routes) ? decl.routes : []) {
      const route = toRoute(raw);
      if (route) routes.push(route);
    }
    for (const raw of Array.isArray(decl.stacks) ? decl.stacks : []) {
      const stack = toStack(raw);
      if (stack) stacks.push(stack);
    }
  }
  return { routes, stacks };
}

function inventoryOf({ readJson, pluginsFile, settingsFile, home }) {
  const base = home ?? os.homedir();
  try {
    return readInventory({
      pluginsFile: pluginsFile ?? path.join(base, ".claude", "plugins", "installed_plugins.json"),
      settingsFile: settingsFile ?? path.join(base, ".claude", "settings.json"),
      readJson: (p) => {
        try {
          return readJson(p);
        } catch {
          return undefined;
        }
      },
    });
  } catch {
    return [];
  }
}
