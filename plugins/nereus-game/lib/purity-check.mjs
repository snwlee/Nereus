// 계층 경계 검사기 — 제작 층의 1단.
//
// `roblox` 와 `unity` 스킬이 똑같이 "로직을 엔진에서 떼어내는 설계가 곧 1단 커버리지"라고
// 적어놓고 **어떻게 떼는지는 비워두었다.** 그 자리를 채운다.
//
// **이 검사기는 계층을 모른다.** 계층 이름도 금지 문자열도 `layers.json` 에 있다.
// 검사기가 알면 스택마다 lib 이 하나씩 는다 — 확장은 코드가 아니라 데이터로 받는다.
//
// 근사다: 언어 파서를 넣지 않고 **줄 단위 문자열 포함**으로 본다. AST 를 파싱하면
// 언어마다 파서가 필요해지고 엔진 불가지론이 깨진다. 주석 처리된 import 도 잡힌다.
// Luau 에는 import 문 자체가 없어서 전역 접근(`game:GetService`)을 같이 봐야 하는데,
// 그래서 `forbid` 는 "import 경로"가 아니라 **"이 계층에 나타나면 안 되는 문자열"** 이다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCliInput, runCli } from "./cli-input.mjs";

// 주석 줄은 건너뛴다. 순수 계층 파일이 문서 주석에 "dart:ui 에 의존하지 않는다"라고
// 적어둔 것을 위반으로 잡았다 — **경계를 지키고 있다고 적은 문장이 경계 위반이 된다**
// (ToonTone lib/core/color/srgb_lab.dart 실측, 2026-09-13).
// 언어별 파서 없이 처리하려면 이게 최선이다. Dart·C#·JS 는 `//`·`///`, Luau·SQL 은 `--`,
// Python·셸은 `#`. 블록 주석(/* */)은 안 본다 — 여는 줄만 보면 오탐이고, 상태를 들고
// 가려면 문자열 리터럴과 구분해야 해서 파서가 된다.
const COMMENT = /^\s*(\/\/|--|#|\*)/;

// new URL(...).pathname 은 Windows 에서 `/C:/...` 가 된다. 메인 개발 환경이 Windows 다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAYERS_PATH = path.join(HERE, "..", "layers.json");

/**
 * 엔진의 기본 계층 경계를 읽는다.
 * 알 수 없는 엔진은 기본값으로 떨어지지 않고 던진다 —
 * 그럴듯한 채로 틀린 판정이 판정 없는 것보다 나쁘다.
 */
export function loadLayers(engine, layersPath = LAYERS_PATH) {
  const data = JSON.parse(fs.readFileSync(layersPath, "utf8"));
  const decls = data?.engines?.[engine];
  if (!decls) {
    throw new Error(`알 수 없는 엔진: ${engine} (있는 것: ${Object.keys(data?.engines ?? {}).join(", ")})`);
  }
  return decls;
}

/**
 * 계층 경계를 집행한다.
 *
 * @param declarations `[{ layer, forbid, why }]` — layer 는 파일 경로 접두사다.
 * @param sources `[{ file, text }]`
 */
export function checkPurity({ declarations = [], sources = [] } = {}) {
  for (const d of declarations) {
    // 이유 없는 경계는 받지 않는다. 경계는 당장은 언제나 불편하고 이득은 나중에 온다 —
    // 왜 있는지가 같이 오지 않으면 읽는 사람은 경계를 지우는 쪽을 택한다.
    if (!String(d?.why ?? "").trim()) {
      throw new Error(`계층 선언에 why 가 없다: ${d?.layer ?? "(이름 없음)"} — 이유 없는 경계가 가장 먼저 지워진다`);
    }
  }

  const violations = [];
  for (const src of sources) {
    const file = String(src?.file ?? "");
    for (const d of declarations) {
      if (!file.startsWith(d.layer)) continue;
      const lines = String(src?.text ?? "").split("\n");
      lines.forEach((line, i) => {
        if (COMMENT.test(line)) return;
        for (const forbidden of d.forbid ?? []) {
          if (!line.includes(forbidden)) continue;
          violations.push({ code: "layer-import", layer: d.layer, file, line: i + 1, forbidden, why: d.why });
        }
      });
    }
  }
  return { violations, approx: true };
}

// 실행 진입점. stdin 으로 { engine | declarations, sources } 를 받아 JSON 을 낸다.
// 검사기를 만들고 부르는 곳이 없으면 그것은 게이트가 아니다.
//
// pathToFileURL 을 쓴다. `file://${process.argv[1]}` 은 Windows 경로에서 깨지고
// `new URL(...).pathname` 은 `/C:/...` 를 만든다. 메인 개발 환경이 Windows 다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    const input = readCliInput();
    // engine 도 declarations 도 없으면 loadLayers 가 사유를 달고 던진다.
    const declarations = input.declarations ?? loadLayers(input.engine);
    process.stdout.write(JSON.stringify(checkPurity({ declarations, sources: input.sources ?? [] })) + "\n");
  });
}
