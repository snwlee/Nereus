// 원격 설정 키 분류 검사기.
//
// 원격 설정은 라이브옵스에서 가장 위험한 코드다 — **원격으로 바뀌고, 관찰이 어렵고,
// 틀리면 몇 주 동안 아무도 모른다.** liveops 도메인이 이벤트·리텐션·롤백을 보면서
// 정작 조종간인 원격 설정 자체는 아무도 안 봤다.
//
// ★ 핵심 함정 (ToonTone 헌법 원칙 IV 에서 채굴, 2026-09-13):
//   **번들 기본값이 있는 키는 원격에 값이 없어도 "설정됨"으로 판정된다.**
//   그래서 그 아래 폴백 계층(등급 내장 기본값 · 플레이버 로컬 설정 · 정책 상수)이
//   실행되지 않고 **조용히 죽는다.** 에러도 로그도 없다.
//   실제로 이 사고로 접이식 배너가 전 등급 영구 OFF 가 된 이력이 있다.
//   안 나오는 것은 원래 그럴 수도 있어서 몇 주 동안 수익이 새는 채로 돌아간다.
//   **검사로 잡지 못하면 사람은 절대 못 잡는다.**
//
// 네 검사 중 실제로 사고를 낸 것은 번들 안전 하나다. 나머지 셋(합집합 · 배타 · 이름 규칙)은
// 분류를 믿을 수 있게 만드는 전제 조건이다 — 분류가 비거나 겹치면 번들 안전 판정 자체가
// 의미를 잃는다. 그래서 심각도를 나눈다. 같은 무게로 보고하면 진짜가 묻힌다.
//
// **분류 이름은 제품마다 다르다.** 검사기는 분류를 모르고 remote-config.json 에 있다 —
// 검사기가 알면 제품마다 lib 이 하나씩 는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";

// new URL(...).pathname 은 Windows 에서 `/C:/...` 가 된다. 메인 개발 환경이 Windows 다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(HERE, "..", "remote-config.json");

const loadFile = (p = CONFIG_PATH) => JSON.parse(fs.readFileSync(p, "utf8"));

/** 기본 분류 체계. 각 분류는 `{ bundleSafe, why }`. */
export function loadConfigClasses(configPath = CONFIG_PATH) {
  return loadFile(configPath).classes;
}

// 내부 전용. 밖에서는 `keyPattern` 인자로 이미 노출된다 —
// 쓰는 곳 없는 export 를 남기면 "선언하고 배선하지 않은 것"이 된다.
function loadKeyPattern(configPath = CONFIG_PATH) {
  return loadFile(configPath).keyPattern;
}

/**
 * @param classes    `{ <name>: { bundleSafe, why } }`. 안 주면 기본 체계.
 * @param declared   선언된 전체 키.
 * @param classified `{ <name>: [key] }`.
 * @param bundleDefaults 번들 기본값에 들어 있는 키. 안 주면 번들 검사를 건너뛴다.
 * @param keyPattern 키 이름 정규식 문자열. 안 주면 기본값.
 */
export function checkRemoteConfig({
  classes = null,
  declared = [],
  classified = {},
  bundleDefaults = null,
  keyPattern = null,
  configPath = CONFIG_PATH,
} = {}) {
  const table = classes ?? loadConfigClasses(configPath);
  for (const [name, c] of Object.entries(table)) {
    // 이유 없는 분류는 받지 않는다. 왜 번들에 넣으면 안 되는지가 같이 오지 않으면
    // 읽는 사람은 "그냥 넣어도 되겠지" 로 간다 — 그게 정확히 사고가 난 경로다.
    if (!String(c?.why ?? "").trim()) {
      throw new Error(`원격 설정 분류에 why 가 없다: ${name} — 왜 번들에 넣으면 안 되는지가 없으면 넣게 된다`);
    }
  }

  for (const name of Object.keys(classified)) {
    // 조용히 무시하면 그 분류의 키들이 아예 검사되지 않은 채 통과한다.
    if (!(name in table)) {
      throw new Error(`알 수 없는 분류: ${name} (있는 것: ${Object.keys(table).join(", ")})`);
    }
  }

  const violations = [];
  const trust = (v) => violations.push({ ...v, severity: "trust" });

  const declaredSet = new Set(declared);
  const classOf = new Map(); // key → [분류 이름]
  for (const [name, keys] of Object.entries(classified)) {
    for (const key of keys ?? []) {
      classOf.set(key, [...(classOf.get(key) ?? []), name]);
    }
  }

  // 합집합 불일치는 **양방향이고 서로 다른 사고**라 코드를 나눈다.
  // 하나로 뭉치면 어느 쪽인지 보고서를 읽고 추측해야 한다.
  for (const key of declared) {
    if (classOf.has(key)) continue;
    trust({ code: "unclassified", key, why: "선언되었는데 어느 분류에도 없다. 이 키는 미설정일 때 어떤 폴백이 적용될지 아무도 모른다." });
  }
  for (const key of classOf.keys()) {
    if (declaredSet.has(key)) continue;
    trust({ code: "phantom", key, classes: classOf.get(key), why: "분류에 있는데 선언에 없다. 원격 콘솔에 없는 키를 읽으므로 영원히 기본값이다." });
  }
  for (const [key, names] of classOf) {
    if (names.length < 2) continue;
    trust({ code: "multi-class", key, classes: names, why: "한 키가 여러 분류에 있다. 어느 폴백 규칙이 이기는지 알 수 없다." });
  }

  const re = new RegExp(keyPattern ?? loadKeyPattern(configPath));
  for (const key of declared) {
    if (re.test(key)) continue;
    trust({ code: "key-pattern", key, pattern: re.source, why: "키는 원격 콘솔에서 사람이 손으로 치는 문자열이다. 오타가 새 키를 만들고 그 실패는 조용하다." });
  }

  // 번들 기본값을 안 주면 그 검사를 건너뛴다. 빈 배열(번들에 아무것도 없다)과
  // 미제공(모른다)은 다른 상태다.
  if (Array.isArray(bundleDefaults)) {
    for (const key of bundleDefaults) {
      const names = classOf.get(key);
      if (!names) {
        // 번들에만 있고 선언·분류 어디에도 없다. 역시 유령이다.
        if (!declaredSet.has(key)) {
          trust({ code: "phantom", key, classes: [], why: "번들 기본값에만 있고 선언에 없다. 아무도 읽지 않는 값이다." });
        }
        continue;
      }
      for (const name of names) {
        if (table[name].bundleSafe) continue;
        violations.push({
          code: "bundle-unsafe",
          key,
          class: name,
          // 실제로 사고를 낸 항목이다. 분류 신뢰도 문제와 같은 무게로 보고하면 묻힌다.
          severity: "incident",
          why: table[name].why,
          how: "번들 기본값이 있는 키는 원격에 값이 없어도 '설정됨'으로 판정되어 그 아래 폴백 계층이 실행되지 않는다. 에러도 로그도 없다.",
        });
      }
    }
  }

  return { violations };
}

// 실행 진입점. 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    process.stdout.write(JSON.stringify(checkRemoteConfig(readCliInput())) + "\n");
  });
}
