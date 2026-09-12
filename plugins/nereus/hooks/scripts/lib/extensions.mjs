// 형제 플러그인 확장 로더.
//
// 코어는 게임·모바일 같은 도메인을 모른다. 그 지식은 별도 플러그인에 두고, 여기서 "데이터만" 받는다.
// 코드를 import() 하지 않는 이유가 둘 있다: (1) 형제 플러그인의 런타임 오류가 코어 훅을 죽이면 안 된다,
// (2) 훅은 5~10초 타임아웃 안에 끝나야 해서 임의 모듈 평가를 감당할 수 없다.
//
// 활성 여부는 **디스크 존재가 아니라 settings.json 의 enabledPlugins 로만** 판단한다.
// 사용자가 끈 플러그인의 라우트가 살아나면 끈 것이 안 꺼진다. (lib/plugin-inventory.mjs 와 같은 규칙)
//
// 모든 읽기는 실패를 삼킨다. 확장이 코어를 죽이면 안 된다.
import fs from "node:fs";
import path from "node:path";

const EXTENSION_FILE = "nereus-extension.json";
const EMPTY = { routes: [], stacks: [] };

function defaultReadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** 설치 기록의 한 항목에서 installPath 를 꺼낸다. 배열이면 첫 항목이 현재 버전이다. */
function installPathOf(value) {
  const v = Array.isArray(value) ? value[0] : value;
  return v && typeof v === "object" && typeof v.installPath === "string" ? v.installPath : "";
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
 * @param {{ readJson?: (p: string) => unknown, settings?: { enabledPlugins?: Record<string, unknown> } }} deps
 * @returns {{ routes: Array<{skill: string, why: string, re: RegExp}>, stacks: Array<object> }}
 */
export function loadExtensions({ readJson = defaultReadJson, settings } = {}) {
  const enabled = settings?.enabledPlugins;
  if (!enabled || typeof enabled !== "object") return { ...EMPTY };

  const routes = [];
  const stacks = [];
  for (const value of Object.values(enabled)) {
    const root = installPathOf(value);
    if (!root) continue;
    let decl;
    try {
      decl = readJson(path.join(root, EXTENSION_FILE));
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
