// 플랫폼·법령 정책 수치 로더.
//
// 장르 프로파일과는 다른 이유로 데이터다. 장르는 **우리가 정하는 값**이고
// 정책은 **남이 정하는 값**이다. 남이 바꾸면 우리가 따라가야 하고,
// 따라가려면 언제 확인한 건지 알아야 한다. 그래서 출처와 확인일을 강제한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, "..", "policy.json");
const defaultDeps = { readJson: (p) => JSON.parse(fs.readFileSync(p, "utf8")) };

export function loadPolicy(deps = defaultDeps) {
  const raw = deps.readJson(FILE);
  // 출처 없는 정책 수치는 다음 사람이 검증할 수 없다. 그런 수치는 추측과 구분되지 않는다.
  if (!raw?.source || !raw?.checkedAt) {
    throw new Error("policy.json 에 source 와 checkedAt 이 있어야 한다 — 출처 없는 정책 수치는 검증할 수 없다");
  }
  return raw;
}

/** 그 시장들이 요구하는 공개 표면의 합집합. 모르는 시장은 무시한다 — 없는 규제를 지어내지 않는다. */
export function surfacesFor(policy, markets = []) {
  const base = policy?.paidRandom?.baseSurfaces ?? [];
  const out = [...base];
  for (const m of Array.isArray(markets) ? markets : []) {
    for (const s of policy?.paidRandom?.markets?.[m]?.surfaces ?? []) {
      if (!out.includes(s)) out.push(s);
    }
  }
  return out;
}
