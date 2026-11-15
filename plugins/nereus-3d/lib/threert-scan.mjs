// ThreeRT 장면 코드의 **정적** 검사. ThreeRT 는 three.js 코드가 그대로 돌게 하려고
// three.js 의 렌더러 설정을 받고 무시한다(상류 packages/scene/src/compat.ts).
// 그래서 three.js 습관으로 쓴 코드가 **에러 없이** 다르게 동작한다 — 그것만 잡는다.
//
// 규칙·근거는 `threert-compat.json` 데이터다. 상류가 바꾸면 그 파일만 고친다.
// 파서를 쓰지 않는다(scene-scan 과 같은 판단). 정규식 기반임을 결과에 항상 밝힌다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripNoise, matchBrace } from "./scene-scan.mjs";
import { readCliInput, runCli } from "./cli-input.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(HERE, "..", "threert-compat.json");

/**
 * ThreeRT 호환 데이터를 읽는다.
 * @returns `{ source, commit, checkedAt, importMarker, evidence, ignoredSettings, libraryOnlyFields, standardMaterials, luxSuspect }`
 */
export function loadThreeRTData(dataPath = DATA_PATH) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {
    throw new Error(`ThreeRT 호환 데이터를 읽을 수 없다 (${dataPath}): ${e?.message ?? e}`);
  }
  return validateThreeRTData(raw);
}

/** 데이터 모양을 확인한다. 깨진 값은 비교가 NaN·빈 정규식이 되어 검사가 **조용히 꺼지거나 폭주한다** — 그래서 던진다. */
function validateThreeRTData(data) {
  const fail = (what) => {
    throw new Error(`threert-compat.json 이 깨졌다: ${what}`);
  };
  for (const key of ["ignoredSettings", "libraryOnlyFields", "standardMaterials", "deferredCallbackMethods", "gameDefiners"]) {
    const list = data[key];
    if (!Array.isArray(list) || list.length === 0) fail(`${key} 가 비었다`);
    if (!list.every((v) => typeof v === "string" && /^[A-Za-z0-9_$.]+$/.test(v))) fail(`${key} 에 식별자가 아닌 항목이 있다`);
  }
  for (const key of ["importMarker", "source", "commit", "checkedAt"]) {
    if (typeof data[key] !== "string" || !data[key]) fail(`${key} 가 없다`);
  }
  const band = data.luxSuspect;
  if (!band || !Number.isFinite(band.above) || !Number.isFinite(band.atMost) || band.above >= band.atMost) {
    fail("luxSuspect 는 above < atMost 인 숫자 구간이어야 한다");
  }
  return data;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** 여는 괄호 위치에서 짝이 맞는 닫는 괄호를 찾는다. 못 찾으면 -1. */
function matchParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 괄호·중괄호·대괄호 밖의 쉼표로 나눈다. 반환은 `[{ text, start }]` (start 는 원본 기준). */
function splitTopLevel(text, base) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i <= text.length; i += 1) {
    const c = text[i];
    if (c === "(" || c === "{" || c === "[") depth += 1;
    else if (c === ")" || c === "}" || c === "]") depth -= 1;
    else if ((c === "," && depth === 0) || i === text.length) {
      parts.push({ text: text.slice(from, i), start: base + from });
      from = i + 1;
    }
  }
  return parts;
}

// setup 본문의 머리. 정규식은 매개변수 여는 괄호(또는 괄호 없는 화살표의 `=>` 앞)까지만 잡는다.
// 반환 타입·`=>` 를 건너 본문을 찾는 일은 findBody 가 한다 — 정규식으로 TS 타입을 다 덮을 수 없다.
// 제네릭 매개변수 목록. 한 단계 중첩(`<T extends Array<number>>`)까지 덮는다. 더 깊으면 unmeasured.
const GENERIC = String.raw`(?:<(?:[^<>()]|<[^<>()]*>)*>\s*)?`;
const BARE_PARAM = String.raw`(?:async\s+)?[A-Za-z_$][A-Za-z0-9_$]*\s*(?==>)`;

// setup 진입점은 **상류의 두 모양뿐**이다(2026-11-15 상류 scenes·games 59개 파일 전수).
// 이름(`setup`·`build`)으로 찾으면 타워 디펜스의 build(type), 엔티티의 setup() 같은 평범한 코드가 차단된다.
//  1) 장면: `export default function build()` · `export default (ctx) => …` · `export default ctx => …`
//  2) 게임: data.gameDefiners(`defineGame`) 에 넘긴 객체 리터럴의 최상위 `setup` 멤버
const DEFAULT_EXPORT_HEADS = [
  new RegExp(String.raw`export\s+default\s+(?:async\s+)?function\s*\*?\s*[A-Za-z0-9_$]*\s*${GENERIC}\(`, "g"),
  new RegExp(String.raw`export\s+default\s+(?:async\s*)?${GENERIC}\(`, "g"),
  new RegExp(String.raw`export\s+default\s+${BARE_PARAM}`, "g"),
];
// 객체 리터럴 멤버 하나의 시작이 setup 정의인가: 메서드 축약 · 함수/화살표 속성 · 괄호 없는 화살표 속성.
const SETUP_MEMBER = [
  new RegExp(String.raw`^\s*(?:async\s+)?\*?\s*setup\s*${GENERIC}\(`),
  new RegExp(String.raw`^\s*setup\s*:\s*(?:async\s*)?(?:function\s*\*?\s*[A-Za-z0-9_$]*\s*)?${GENERIC}\(`),
  new RegExp(String.raw`^\s*setup\s*:\s*${BARE_PARAM}`),
];
// 결정론을 깨는 호출. `new Date` 는 인자가 없을 때만(괄호 없는 꼴 포함) — `new Date(ts)` 는 결정론이다.
// `performance.now()` 는 넣지 않는다: 상류 벤치(games/instancing/bench.game.ts)가 setup 시간을 재는 데 쓰고,
// 시간 측정은 장면 내용을 바꾸지 않는다. 상류 런타임이 결정론으로 바꿔 끼우는 것도 Math.random·Date 뿐이다.
// 앞뒤 단어 경계를 둔다 — `SimDate.now()`·`FastMath.random()`·`new DateRange(` 는 다른 것이다.
const NONDETERMINISTIC =
  /(?<![A-Za-z0-9_$.])(?:Math\s*\.\s*random\s*\(|Date\s*\.\s*now\s*\(|new\s+Date(?![A-Za-z0-9_$])\s*(?:\(\s*\)|(?!\s*\())|crypto\s*\.\s*(?:randomUUID|getRandomValues)\s*\()/g;

const skipWs = (t, i) => {
  while (i < t.length && /\s/.test(t[i])) i += 1;
  return i;
};

/**
 * 반환 타입을 건너 본문 시작(`{` 또는 `=>`) 위치를 낸다. 못 찾으면 -1.
 * 객체 타입 `{ a: 1 }` 은 닫힌 뒤 `{`·`|`·`&`·`[`·`>`·`=>` 가 이어지거나 `<…>` 안에 있으므로 본문과 구분된다.
 * 함수 타입 `(a) => void` 의 `=>` 는 괄호 바로 뒤에 오므로 화살표 본문과 구분된다.
 */
function skipReturnType(t, i) {
  let angle = 0;
  let afterParen = false;
  while (i < t.length) {
    const c = t[i];
    if (c === "=" && t[i + 1] === ">") {
      if (afterParen || angle > 0) {
        i += 2;
        afterParen = false;
        continue;
      }
      return i;
    }
    if (c === "(") {
      const close = matchParen(t, i);
      if (close === -1) return -1;
      i = close + 1;
      afterParen = true;
      continue;
    }
    if (c === "{") {
      const close = matchBrace(t, i);
      if (close === -1) return -1;
      const next = skipWs(t, close + 1);
      // `"…".includes("")` 는 true 다 — 파일 끝(undefined)을 타입으로 읽지 않게 길이를 먼저 본다.
      const follows = next < t.length && "{|&[>".includes(t[next]);
      if (angle > 0 || follows || t.startsWith("=>", next)) {
        i = close + 1;
        afterParen = false;
        continue;
      }
      return i;
    }
    if ((c === ";" || c === "}" || c === ")") && angle === 0) return -1;
    if (c === "<") angle += 1;
    else if (c === ">") angle = Math.max(0, angle - 1);
    if (!/\s/.test(c)) afterParen = false;
    i += 1;
  }
  return -1;
}

/**
 * 매개변수 뒤에서 함수 본문 범위 `[open, close]` 를 찾는다. 함수 정의가 아니면(호출 `setup(x);`) null.
 * 화살표의 식 본문 `=> ({ … })` 은 괄호 범위를 본문으로 본다. 그 밖의 식 본문은 보지 않는다(unmeasured).
 */
function findBody(t, from) {
  let i = skipWs(t, from);
  if (t[i] === ":") {
    i = skipReturnType(t, i + 1);
    if (i === -1) return null;
  }
  if (t.startsWith("=>", i)) {
    i = skipWs(t, i + 2);
    if (t[i] === "(") {
      const close = matchParen(t, i);
      return close === -1 ? null : [i, close];
    }
  }
  if (t[i] !== "{") return null;
  const close = matchBrace(t, i);
  return close === -1 ? null : [i, close];
}

/** 머리 정규식이 끝난 곳에서 본문 탐색을 시작할 위치. 괄호로 끝나면 매개변수를 건넌다. */
function afterHead(clean, end) {
  if (clean[end - 1] !== "(") return end;
  const params = matchParen(clean, end - 1);
  return params === -1 ? -1 : params + 1;
}

/** setup 진입점 본문 범위들 `[open, close]`. */
function setupBodies(clean, gameDefiners) {
  const bodies = [];
  const push = (from) => {
    if (from === -1) return;
    const body = findBody(clean, from);
    if (body && !bodies.some(([a]) => a === body[0])) bodies.push(body);
  };
  for (const re of DEFAULT_EXPORT_HEADS) {
    for (const m of clean.matchAll(re)) push(afterHead(clean, m.index + m[0].length));
  }
  const names = gameDefiners.map(escapeRe).join("|");
  const definer = new RegExp(String.raw`(?<![A-Za-z0-9_$.])(?:${names})\s*${GENERIC}\(\s*\{`, "g");
  for (const m of clean.matchAll(definer)) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(clean, open);
    if (close === -1) continue;
    // 최상위 멤버만 본다 — `handlers: { setup(s) {…} }` 는 핸들러다.
    for (const part of splitTopLevel(clean.slice(open + 1, close), open + 1)) {
      for (const re of SETUP_MEMBER) {
        const hit = re.exec(part.text);
        if (hit) push(afterHead(clean, part.start + hit[0].length));
      }
    }
  }
  return bodies;
}

/**
 * 화살표의 식 본문 `=> spawn(Math.random())` 범위: `=>` 뒤부터 괄호 밖의 `;`·줄바꿈·`,`·`}` 까지.
 * 리스너 정의를 **빼는** 데만 쓴다 — 범위가 넓게 잡혀도 위반이 사라질 뿐 거짓 위반은 생기지 않는다.
 */
function expressionBody(t, from) {
  let i = skipWs(t, from);
  if (!t.startsWith("=>", i)) return null;
  const start = i;
  let depth = 0;
  for (i += 2; i < t.length; i += 1) {
    const c = t[i];
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && (c === ";" || c === "\n" || c === ",")) break;
  }
  return [start, i];
}

/**
 * setup 안에서 **등록만** 하는 콜백의 범위. 리스너는 나중에 이벤트로 불리고 런타임이 결정론으로 감싼다
 * (상류 node-host.ts `withDeterminism(… channel.deliver …)`). 인라인 콜백과, 이름으로 넘긴 콜백
 * (`const onTap = () => …; ctx.on("tap", onTap)` · `function onHit() {…}`) 의 정의 본문을 낸다.
 * `xs.map(() => Math.random())` 은 setup 안에서 바로 돌므로 빼지 않는다.
 */
function deferredRanges(clean, open, close, methods) {
  const names = methods.map(escapeRe).join("|");
  const register = new RegExp(String.raw`\.\s*(?:${names})\s*\(`, "g");
  const body = clean.slice(open, close);
  const ranges = [];
  const passedByName = new Set();
  for (const m of body.matchAll(register)) {
    const paren = open + m.index + m[0].length - 1;
    const end = matchParen(clean, paren);
    if (end === -1) continue;
    ranges.push([paren, end]);
    for (const arg of splitTopLevel(clean.slice(paren + 1, end), paren + 1)) {
      const id = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*$/.exec(arg.text)?.[1];
      if (id) passedByName.add(id);
    }
  }
  for (const id of passedByName) {
    const name = escapeRe(id);
    const defs = new RegExp(
      String.raw`(?:(?:const|let|var)\s+${name}\s*=\s*(?:async\s*)?(?:function\s*\*?\s*[A-Za-z0-9_$]*\s*)?${GENERIC}\(|(?:const|let|var)\s+${name}\s*=\s*${BARE_PARAM}|function\s*\*?\s*${name}\s*${GENERIC}\()`,
      "g",
    );
    for (const d of body.matchAll(defs)) {
      const from = afterHead(clean, open + d.index + d[0].length);
      if (from === -1) continue;
      const found = findBody(clean, from) ?? expressionBody(clean, from);
      if (found) ranges.push(found);
    }
  }
  return ranges;
}

function checkSetup(file, clean, data, out) {
  for (const [open, close] of setupBodies(clean, data.gameDefiners)) {
    const deferred = deferredRanges(clean, open, close, data.deferredCallbackMethods);
    for (const m of clean.slice(open, close).matchAll(NONDETERMINISTIC)) {
      const at = open + m.index;
      if (deferred.some(([a, b]) => at > a && at < b)) continue;
      out.violations.push({
        code: "threert-setup-nondeterministic",
        file,
        line: lineOf(clean, at),
        call: m[0].replace(/\s+/g, ""),
        fix: "setup 이 받는 seed·random(또는 PyRandom)을 쓴다 — 핸들러와 달리 setup 은 결정론으로 감싸지 않는다",
      });
    }
  }
}

function checkCompat(file, clean, data, out) {
  for (const m of clean.matchAll(/\.\s*setAnimationLoop\s*\((?!\s*(?:null|undefined)\s*\))/g)) {
    out.violations.push({
      code: "threert-animation-loop",
      file,
      line: lineOf(clean, m.index),
      fix: "콜백은 호출되지 않는다. 매 프레임 일은 게임의 frame(f) 스크립트로 옮긴다",
    });
  }
  for (const m of clean.matchAll(/\.\s*info\s*\.\s*(?:render|memory)\b/g)) {
    out.violations.push({
      code: "threert-info-stub",
      file,
      line: lineOf(clean, m.index),
      fix: "0 고정 스텁이다. 드로우콜·GPU 메모리는 이 값으로 측정할 수 없다 — renderbudget 표본으로 쓰지 않는다",
    });
  }
  for (const setting of data.ignoredSettings) {
    const pathRe = setting.split(".").map(escapeRe).join("\\s*\\.\\s*");
    // 대입은 경로 바로 뒤에서만 본다. 복합 대입·`++`·`--` 는 쓰기다. `>=`·`<=`·`!=`·`=>`·`==` 은 아니다.
    const re = new RegExp(
      `\\.\\s*${pathRe}(?![A-Za-z0-9_$])(?:\\s*\\.\\s*[A-Za-z0-9_$]+)*\\s*(?:(?:\\*\\*|<<|>>>|>>|&&|\\|\\||\\?\\?|[-+*/%&|^])?=(?![=>])|\\+\\+|--|\\.\\s*(?:set|copy)\\s*\\()`,
      "g",
    );
    for (const m of clean.matchAll(re)) {
      out.warnings.push({
        code: "threert-ignored-setting",
        file,
        line: lineOf(clean, m.index),
        setting,
        fix: Object.entries(data.ignoredSettingsFix ?? {}).find(([prefix]) => setting.startsWith(prefix))?.[1]
          ?? "ThreeRT 는 이 설정을 받고 무시한다",
      });
    }
  }
}

function checkMaterials(file, clean, data, out) {
  const names = data.standardMaterials.map(escapeRe).join("|");
  const fields = new Set(data.libraryOnlyFields);
  for (const m of clean.matchAll(new RegExp(`new\\s+(?:[A-Za-z0-9_$]+\\s*\\.\\s*)?(${names})\\s*\\(\\s*\\{`, "g"))) {
    const open = m.index + m[0].length - 1;
    const close = matchBrace(clean, open);
    if (close === -1) continue;
    const found = splitTopLevel(clean.slice(open + 1, close), open + 1)
      .map((p) => /^\s*([A-Za-z0-9_$]+)\s*(?::|$)/.exec(p.text)?.[1]) // `wet: 1` 과 축약 `{ wet }`
      .filter((k) => k && fields.has(k));
    if (found.length === 0) continue;
    out.violations.push({
      code: "threert-library-field",
      file,
      line: lineOf(clean, m.index),
      material: m[1],
      fields: found,
      fix: "표준 머티리얼은 이 키를 저장만 하고 렌더하지 않는다. SurfaceMaterial 로 옮긴다",
    });
  }
}

function checkLights(file, clean, data, out) {
  const band = data.luxSuspect;
  for (const m of clean.matchAll(/new\s+(?:[A-Za-z0-9_$]+\s*\.\s*)?DirectionalLight\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(clean, open);
    if (close === -1) continue;
    const args = splitTopLevel(clean.slice(open + 1, close), open + 1);
    const raw = args[1]?.text.trim().replace(/_/g, "");
    if (!raw || !/^\d*\.?\d+(?:e[+-]?\d+)?$/i.test(raw)) continue;
    const value = Number(raw);
    if (!(value > band.above && value <= band.atMost)) continue;
    out.warnings.push({
      code: "threert-lux-suspect",
      file,
      line: lineOf(clean, m.index),
      value,
      fix: "intensity 는 lux 다. 태양 ~100 000, 흐린 날 ~10 000, 달빛 0.1–0.3",
    });
  }
}

// import 문의 모듈 문자열 여는 따옴표. 주석은 지운 텍스트에서 찾으므로 `// from "@threert/x"` 에 속지 않는다.
const IMPORT_QUOTE = /(?:(?<![A-Za-z0-9_$])from\s*|(?<![A-Za-z0-9_$.])import\s*\(\s*|(?<![A-Za-z0-9_$.])require\s*\(\s*|(?<![A-Za-z0-9_$.])import\s+)(["'`])/g;

/** 문자열 내용은 clean 에서 지워졌으므로 따옴표 위치를 clean 에서 찾고 내용은 raw 에서 읽는다(길이 보존). */
function importsMarker(raw, clean, marker) {
  for (const m of clean.matchAll(IMPORT_QUOTE)) {
    if (raw.startsWith(marker, m.index + m[0].length)) return true;
  }
  return false;
}

/**
 * ThreeRT 장면 소스를 훑는다. **전체 소스를 한 번에 넘긴다** — import 가 한 파일에만 있어도 전부 본다.
 * @param {{ sources?: {file: string, text: string}[], data?: object }} input
 * @returns `{ applies, violations, warnings, unmeasured }`
 */
export function scanThreeRT({ sources = [], data = loadThreeRTData() } = {}) {
  validateThreeRTData(data);
  const marker = data.importMarker;
  const out = { applies: false, violations: [], warnings: [], unmeasured: [] };
  const prepared = sources.map(({ file, text }) => {
    const raw = String(text ?? "");
    return { file, raw, clean: stripNoise(raw) };
  });
  // applies 는 프로젝트 단위(호환 규칙), setup 진입점은 파일 단위다 — 같은 프로젝트의 vite.config.ts·React HUD 의
  // `export default` 를 장면 진입점으로 읽지 않으려고 그 파일이 직접 import 할 때만 본다.
  for (const p of prepared) p.importsThreeRT = importsMarker(p.raw, p.clean, marker);
  out.applies = prepared.some((p) => p.importsThreeRT);
  if (!out.applies) {
    out.unmeasured.push({
      what: `어떤 소스도 ${marker} 를 import 하지 않는다 — ThreeRT 규칙을 적용하지 않았다`,
      why: "plain three.js 에서는 이 규칙들이 전부 틀린 경고다. three.js 코드는 nereus-3d:threejs 의 scene-scan 으로 본다.",
    });
    return out;
  }
  out.unmeasured.push(
    {
      what: "정적 검사는 정규식 기반이다 — AST 파서를 쓰지 않는다",
      why:
        "보이지 않는 것: setup 이 부르는 헬퍼 안의 비결정 호출, setup 이 돌려준 객체 안의 나중에 불리는 클로저(위반으로 나온다), " +
        "템플릿 문자열 `${...}`·JSX 텍스트의 따옴표·정규식 리터럴 뒤의 코드(문자열로 지워진다), 화살표의 괄호 없는 식 본문, " +
        "객체 타입을 품은 조건부 반환 타입, 두 단계 넘게 중첩된 제네릭, 목록에 없는 이름으로 등록하는 리스너, 전위 `++x.shadow.radius`, " +
        "생성 뒤의 `m.wet = 0.8`·`m.setValues({ wet })`, 변수·스프레드로 넘긴 머티리얼 파라미터, `sun.intensity = 3`, " +
        "`const { info } = renderer` 같은 구조 분해, 동적으로 조립한 설정, " +
        "모듈 최상위의 비결정 호출(로드 때 한 번 돈다), 호출 없이 넘긴 `Math.random` 참조, " +
        "`defineGame({ setup })` 축약·`setup: setupLevel` 처럼 이름으로 넘긴 setup, `export default build;`, " +
        "@threert 를 직접 import 하지 않는 파일의 setup. 통과가 정상을 증명하지 않는다. " +
        "거꾸로 위반이 틀릴 수 있는 곳: setup 안에 정의돼 리스너에서만 불리는 클로저, renderer 가 아닌 객체의 `.info.render`.",
    },
    {
      what: "setup 진입점은 `export default` 함수와 gameDefiners(defineGame) 에 넘긴 객체의 최상위 setup 뿐이다",
      why:
        `이름(setup·build)으로 찾으면 평범한 게임 코드가 차단된다. 래퍼(levelGame( 같은 것)로 정의한 게임은 ` +
        `따라가지 못한다 — 래퍼 이름을 threert-compat.json 의 gameDefiners(현재 ${data.gameDefiners.join(", ")})에 더하면 본다.`,
    },
    {
      what: `규칙은 상류 커밋 ${String(data.commit).slice(0, 7)}(${data.checkedAt}) 기준이다`,
      why: `ThreeRT 는 빠르게 바뀐다. 출처: ${data.source}. 낡으면 threert-compat.json 을 다시 확인한다.`,
    },
  );
  for (const { file, clean, importsThreeRT } of prepared) {
    checkCompat(file, clean, data, out);
    if (importsThreeRT) checkSetup(file, clean, data, out);
    checkMaterials(file, clean, data, out);
    checkLights(file, clean, data, out);
  }
  return out;
}

// 프로세스 진입점. stdin JSON → stdout JSON. 성공 경로에서 exit 하지 않는다(cli-input.mjs 참고).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(() => {
    process.stdout.write(`${JSON.stringify(scanThreeRT(readCliInput()), null, 2)}\n`);
  });
}
