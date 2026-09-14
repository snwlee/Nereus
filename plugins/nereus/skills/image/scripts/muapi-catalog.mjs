// Muapi 모델 카탈로그 로더. **모델 이름을 코드에 박지 않는다** —
// 상류(Muapi)가 정하고 상류가 바꾸는 값이라, 박으면 조용히 낡는다.
// 스킬은 "무엇을 하고 싶은가"(능력)로 고르고, 어떤 모델이 되는지는 데이터가 정한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// new URL(...).pathname 은 Windows 에서 `/C:/...` 가 된다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(HERE, "..", "muapi-models.json");

/** 카탈로그를 읽는다. 없으면 사유 있는 오류다. */
export function loadMuapiCatalog(dataPath = DATA_PATH) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {
    throw new Error(`Muapi 모델 카탈로그를 읽을 수 없다 (${dataPath}): ${e?.message ?? e}`);
  }
  if (!raw.models || typeof raw.models !== "object") {
    throw new Error("muapi-models.json 에 models 가 없다");
  }
  return raw;
}

/**
 * 능력으로 모델 목록을 고른다.
 * @param {string} capability t2i · i2i · t2v · i2v · v2v · lipsync · recast · motionControl · audio
 */
export function pickModels(capability, catalog = loadMuapiCatalog()) {
  const list = catalog.models[capability];
  if (!Array.isArray(list)) {
    const known = Object.keys(catalog.models).join(", ");
    throw new Error(`모르는 능력 '${capability}'. 아는 능력: ${known}`);
  }
  return list;
}

/** 능력별 모델 수. 무엇이 있는지 한 줄로 보여줄 때 쓴다. */
export function catalogSummary(catalog = loadMuapiCatalog()) {
  return Object.fromEntries(Object.entries(catalog.models).map(([k, v]) => [k, v.length]));
}
