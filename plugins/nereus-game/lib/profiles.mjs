// 장르 프로파일 로더.
//
// 장르를 스킬 안의 분기로 두면 장르가 늘 때마다 도메인 스킬 5개를 전부 고쳐야 한다.
// 데이터로 두면 장르 추가가 파일 한 장이다.
//
// **알 수 없는 장르는 기본값으로 떨어지지 않고 던진다.** 조용히 다른 장르로 밸런싱하면
// 수치가 그럴듯한 채로 틀리고, 그건 수치가 없는 것보다 나쁘다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(HERE, "..", "profiles");
const REQUIRED = ["genre", "loop", "metrics", "balance"];

const defaultDeps = {
  readJson: (p) => JSON.parse(fs.readFileSync(p, "utf8")),
  readDir: (p) => fs.readdirSync(p),
};

/** 빠진 필수 키 이름 배열. 비어 있으면 유효하다. */
export function validateProfile(obj) {
  if (!obj || typeof obj !== "object") return [...REQUIRED];
  const missing = REQUIRED.filter((k) => obj[k] === undefined || obj[k] === null);
  if (!missing.includes("loop") && !Array.isArray(obj.loop)) missing.push("loop");
  return missing;
}

export function listProfiles(deps = defaultDeps) {
  try {
    return deps.readDir(PROFILE_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

export function loadProfile(genre, deps = defaultDeps) {
  let raw;
  try {
    raw = deps.readJson(path.join(PROFILE_DIR, `${genre}.json`));
  } catch {
    throw new Error(`알 수 없는 장르: ${genre} (있는 것: ${listProfiles(deps).join(", ") || "없음"})`);
  }
  const missing = validateProfile(raw);
  if (missing.length) throw new Error(`알 수 없는 장르: ${genre} — 프로파일에 ${missing.join(", ")} 가 없다`);
  return raw;
}
