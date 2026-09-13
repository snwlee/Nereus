// 트랙 규칙 로더.
//
// 트랙은 **사업 판단**이다. 이 파일은 강제 조건과 규모 임계값만 데이터로 들고,
// 판단 자체는 사용자가 한다. 하네스가 사업을 결정하면 안 된다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, "..", "tracks.json");
const defaultDeps = { readJson: (p) => JSON.parse(fs.readFileSync(p, "utf8")) };

export function loadTracks(deps = defaultDeps) {
  const raw = deps.readJson(FILE);
  // 추정을 추정이라고 표시하지 않은 임계값은 틀린 확신을 준다.
  // 조용한 추정이 추정 없는 것보다 나쁜 이유다 — l10n 에서 이미 한 번 겪었다.
  if (raw?.manyTrack?.estimate !== true || !raw?.manyTrack?.basis) {
    throw new Error("tracks.json 의 manyTrack 에 estimate:true 와 basis 가 있어야 한다 — 근거 없는 임계값은 틀린 확신을 준다");
  }
  return raw;
}

export function platformRule(tracks, id) {
  const r = tracks?.platforms?.[id];
  if (!r) throw new Error(`알 수 없는 플랫폼: ${id} (있는 것: ${Object.keys(tracks?.platforms ?? {}).join(", ")})`);
  return r;
}

export function revenueRule(tracks, id) {
  const r = tracks?.revenue?.[id];
  if (!r) throw new Error(`알 수 없는 수익 모델: ${id} (있는 것: ${Object.keys(tracks?.revenue ?? {}).join(", ")})`);
  return r;
}
