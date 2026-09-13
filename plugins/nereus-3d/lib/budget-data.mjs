// 3D 판정 데이터. **텍스처 슬롯은 three.js 가 정하고 three.js 가 바꾸는 값**이라
// 코드에 박지 않는다 — 상류가 슬롯을 늘리면 검사기가 조용히 불완전해진다.
//
// **예산 수치는 여기 없다.** 드로우콜 상한·텍스처 예산은 기기 등급·해상도·씬 복잡도가
// 정하는 운영값이다. 정책 데이터 파일에 넣으면 정책인 척하면서 낡는다
// (nereus-ads 의 쿨다운·세션 상한과 같은 판단). 검사기가 입력으로 받는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// new URL(...).pathname 은 Windows 에서 `/C:/...` 가 된다. 메인 개발 환경이 Windows 다.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(HERE, "..", "three-budget.json");

/**
 * 판정 데이터를 읽는다.
 * @returns `{ source, checkedAt, extractedFrom, howExtracted, textureSlots, sweepMarker, leakAxes }`
 */
export function loadBudgetData(dataPath = DATA_PATH) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {
    // 사유 없는 ENOENT 스택을 그대로 올리면 무엇이 없어서 실패했는지 호출부가 모른다.
    throw new Error(`3D 판정 데이터를 읽을 수 없다 (${dataPath}): ${e?.message ?? e}`);
  }
  if (!Array.isArray(raw.textureSlots) || raw.textureSlots.length === 0) {
    throw new Error("three-budget.json 에 textureSlots 가 없다");
  }
  return raw;
}
