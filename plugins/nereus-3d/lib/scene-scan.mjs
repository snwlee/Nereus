// three.js 씬 코드의 **정적** 검사. 파서를 쓰지 않는다 — 새 런타임 의존성을 더하지 않고,
// three.js 를 설치해 실제로 파싱하지도 않는다. 정규식 기반임을 결과에 항상 밝힌다.
//
// 잡는 것: 머티리얼을 dispose 하면서 텍스처 슬롯을 일부만 정리하는 코드.
// 빠진 슬롯의 텍스처는 GPU 에 남고 **아무 에러도 나지 않는다** — 프레임만 떨어진다.
import { loadBudgetData } from "./budget-data.mjs";

/** 검사 대상 소스의 한 조각. */
const IDENT = "[A-Za-z0-9_$]";

/**
 * 문자열·주석 내용을 같은 길이의 공백으로 지운다.
 * 중괄호 짝 세기와 토큰 탐지가 문자열 안의 `{` 나 주석 안의 `dispose` 에 속지 않게 한다.
 * 길이를 보존하므로 원본 인덱스가 그대로 유효하다.
 */
export function stripNoise(text) {
  const out = text.split("");
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k += 1) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      let j = text.indexOf("\n", i);
      if (j === -1) j = text.length;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && next === "*") {
      let j = text.indexOf("*/", i + 2);
      j = j === -1 ? text.length : j + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") { j += 2; continue; }
        if (text[j] === c) break;
        j += 1;
      }
      blank(i + 1, j);
      i = Math.min(j + 1, text.length);
      continue;
    }
    i += 1;
  }
  return out.join("");
}

// `function f(...) {` · `const f = (...) => {` · `const f = function (...) {`
const FN_HEAD = new RegExp(
  `(?:function\\s+(${IDENT}+)\\s*\\([^)]*\\)\\s*\\{)` +
    `|(?:(?:const|let|var)\\s+(${IDENT}+)\\s*=\\s*(?:async\\s+)?` +
    `(?:function\\s*\\*?\\s*\\([^)]*\\)|\\([^)]*\\)\\s*=>|${IDENT}+\\s*=>)\\s*\\{)`,
  "g",
);

/** 여는 중괄호 위치에서 짝이 맞는 닫는 위치를 찾는다. 못 찾으면 -1. */
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 이름 있는 함수 정의를 뽑는다. 문자열·주석은 지운 텍스트에서 본다.
 * @returns `[{ file, fn, body, start, end }]`
 */
export function findFunctions(file, clean) {
  const found = [];
  FN_HEAD.lastIndex = 0;
  let m;
  while ((m = FN_HEAD.exec(clean)) !== null) {
    const open = clean.lastIndexOf("{", FN_HEAD.lastIndex - 1);
    const close = matchBrace(clean, open);
    if (close === -1) continue;
    found.push({
      file,
      fn: m[1] ?? m[2],
      body: clean.slice(open + 1, close),
      start: m.index,
      end: close,
    });
    // 중첩 함수도 각각 보고 싶으므로 lastIndex 를 본문 끝으로 밀지 않는다.
  }
  return found;
}

/** 식별자 경계를 지켜 토큰이 등장하는지 본다. `map` 이 `roadmap`·`mapping` 에 걸리지 않게. */
function mentions(text, token) {
  return new RegExp(`(?<![A-Za-z0-9_$])${token}(?![A-Za-z0-9_$])`).test(text);
}

/**
 * 씬 소스를 정적으로 훑는다.
 * @param {{ sources?: {file: string, text: string}[], data?: object }} input
 * @returns `{ violations, unmeasured }`
 */
export function scanScene({ sources = [], data = loadBudgetData() } = {}) {
  const slots = data.textureSlots;
  const sweep = data.sweepMarker;
  const violations = [];
  const unmeasured = [
    {
      what: "정적 검사는 정규식 기반이다 — AST 파서를 쓰지 않는다",
      why:
        "새 런타임 의존성을 더하지 않기로 했다. 동적으로 만든 이름·문자열로 조립한 접근·" +
        "런타임에만 정해지는 머티리얼은 여기서 보이지 않는다. 통과가 정리를 증명하지 않는다.",
    },
  ];

  // 1) 모든 소스의 함수를 먼저 모은다. 위임 대상이 다른 파일에 있을 수 있다.
  const functions = [];
  for (const { file, text } of sources) {
    for (const fn of findFunctions(file, stripNoise(String(text ?? "")))) {
      const missingSlots = slots.filter((s) => !mentions(fn.body, s));
      functions.push({
        ...fn,
        missingSlots,
        // 머티리얼을 dispose 하지 않는 함수는 이 검사의 대상이 아니다.
        // 슬롯 이름이 보이면 변수명이 `m` 이어도 머티리얼을 만지는 것이다.
        isCandidate:
          /\.dispose\s*\(/.test(fn.body) &&
          (/material/i.test(fn.body) || missingSlots.length < slots.length),
        // 속성 순회는 슬롯 나열보다 강하다 — 상류가 슬롯을 늘려도 자동으로 덮인다.
        isComplete: mentions(fn.body, sweep) || missingSlots.length === 0,
      });
    }
  }

  // 2) 위임을 따라간다. 완전한 헬퍼를 부르는 함수도 완전하다 —
  //    **호출 지점을 확인하기 전에 결함이라 부르지 않는다.** 전이 위임까지 보려고 고정점을 돈다.
  for (let changed = true; changed; ) {
    changed = false;
    const complete = new Set(functions.filter((f) => f.isComplete).map((f) => f.fn));
    for (const f of functions) {
      if (f.isComplete) continue;
      for (const name of complete) {
        if (name === f.fn || !mentions(f.body, name)) continue;
        f.isComplete = true;
        f.delegatesTo = name;
        changed = true;
        break;
      }
    }
  }

  const listedEverySlot = functions.some(
    (f) => f.isCandidate && f.missingSlots.length === 0 && !mentions(f.body, sweep),
  );

  for (const f of functions) {
    if (!f.isCandidate || f.isComplete) continue;
    violations.push({
      code: "incomplete-dispose",
      file: f.file,
      fn: f.fn,
      missingSlots: f.missingSlots,
      why:
        `머티리얼을 dispose 하면서 슬롯 ${f.missingSlots.length}종을 정리하지 않는다. ` +
        "그 텍스처는 GPU 에 남고 에러는 나지 않는다.",
      fix: `본문에서 속성을 순회하며 \`${sweep}\` 인 값을 dispose 한다 — 슬롯을 나열하지 않는다.`,
    });
  }

  if (listedEverySlot) {
    unmeasured.push({
      what: `슬롯을 전부 나열한 dispose 는 슬롯 목록 확인일(${data.checkedAt}) 기준으로만 완전하다`,
      why:
        `three.js 가 슬롯을 늘리면 그 코드는 조용히 불완전해진다. 출처: ${data.source} ` +
        `(${data.extractedFrom}). 속성 순회로 바꾸면 이 기준이 필요 없다.`,
    });
  }

  return { violations, unmeasured };
}
