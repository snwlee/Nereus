// 대상 언어 집합은 코드가 아니라 데이터다. 검사기 안에 목록을 박으면
// 시장이 바뀔 때마다 검사기를 고쳐야 한다. 장르 프로파일과 같은 이유다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, "..", "locales.json");
const defaultDeps = { readJson: (p) => JSON.parse(fs.readFileSync(p, "utf8")) };

export function loadLocales(deps = defaultDeps) {
  const raw = deps.readJson(FILE);
  if (!raw || typeof raw.base !== "string" || !raw.locales || typeof raw.locales !== "object") {
    throw new Error("locales.json 이 base 와 locales 를 갖고 있지 않다");
  }
  if (!(raw.base in raw.locales)) throw new Error(`기준 로케일 ${raw.base} 가 locales 에 없다`);
  return raw;
}

export function localeIds(data) {
  return Object.keys(data?.locales ?? {});
}

export function expansionOf(data, id) {
  const entry = data?.locales?.[id];
  if (!entry) throw new Error(`알 수 없는 로케일: ${id} (있는 것: ${localeIds(data).join(", ")})`);
  const n = Number(entry.expansion);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`로케일 ${id} 의 expansion 이 수치가 아니다`);
  return n;
}
