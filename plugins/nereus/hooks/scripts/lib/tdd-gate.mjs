// TDD 강제 판정. PreToolUse(Edit|Write|MultiEdit) 에서 구현 파일 편집을 실제로 차단한다.
// PostToolUse 의 tdd-guard 는 편집이 끝난 뒤라 경고밖에 못 한다 — 순서를 강제하려면 여기여야 한다.
//
// 규칙(enforce="block"):
//   RED(마지막 테스트 실행 실패)        → 허용. 지금이 구현 단계다.
//   GREEN + 대응 테스트 있음            → 허용. REFACTOR 단계다(allowRefactor:false 로 잠글 수 있다).
//   GREEN + 대응 테스트 없음            → 차단. 테스트 없이 새 기능을 시작하려는 것이다.
//   테스트를 한 번도 안 돌림            → 차단. RED 를 가정할 수 없다.
// 순수 함수. 파일시스템·git 접근은 호출자가 넘긴다.
import { isSourceFile, isTestFile } from "./stack.mjs";
import { globToRegExp } from "../tdd-guard.mjs";

export const OVERRIDE_FILE = ".nereus/tdd-override";

const MARKER = /(\.(test|spec)|_test|_tests|test|tests)$/i;

/** 파일명에서 테스트 표식을 떼어낸 어간. cart.test.ts / cart_test.dart / CartTest.java → "cart" */
export function testStem(file) {
  const baseName = file.replace(/\\/g, "/").split("/").pop() ?? "";
  const noExt = baseName.replace(/\.[^.]+$/, "");
  const stripped = noExt.replace(/\.(test|spec)$/i, "").replace(/_tests?$/i, "").replace(/Tests?$/, "");
  return (stripped || noExt).toLowerCase();
}

/** 소스 파일에 대응하는 테스트 파일을 찾는다. 같은 어간이면 어느 트리에 있든 인정한다. */
export function findTestFor(rel, files) {
  const stem = testStem(rel);
  return files.find((f) => f !== rel && isTestFile(f) && testStem(f) === stem) ?? null;
}

const allow = (via) => ({ allow: true, via });

export function tddVerdict({ rel, enforce = "warn", runner, exclude = [], evidence, hasTest, override = null, allowRefactor = true }) {
  if (enforce !== "block") return allow("enforce-off");
  if (!runner) return allow("no-runner");                    // 강제할 근거가 없다
  if (isTestFile(rel)) return allow("test-file");            // 테스트는 언제나 먼저 쓸 수 있어야 한다
  if (!isSourceFile(rel)) return allow("not-source");
  if (exclude.some((g) => globToRegExp(g).test(rel))) return allow("excluded");
  if (override) return { allow: true, via: "override", consumeOverride: true, reason: override };

  const how = `빠져나가려면: 1) 실패하는 테스트를 쓰고 run-tests.mjs 로 돌린다(정공법) 2) 사유를 적어 ${OVERRIDE_FILE} 를 만들면 다음 편집 1회만 통과 3) 급하면 tdd.enforce 를 "warn" 으로 낮춘다.`;

  if (!evidence || evidence.status === "MISSING") {
    return { allow: false, reason: `[nereus:tdd] ${rel} — 이 프로젝트에서 테스트를 한 번도 돌리지 않았습니다(${runner.command}). RED 를 가정할 수 없어 구현 편집을 막습니다. ${how}` };
  }
  if (evidence.exitCode !== 0) return allow("red");           // 실패 중 = 구현해도 되는 단계

  if (hasTest) {
    if (allowRefactor) return allow("refactor");
    return { allow: false, reason: `[nereus:tdd] ${rel} — 테스트가 전부 통과 중입니다(GREEN). allowRefactor:false 설정이라 리팩터링도 실패 테스트 없이는 막습니다. ${how}` };
  }
  return { allow: false, reason: `[nereus:tdd] ${rel} — 테스트가 전부 통과 중이고(GREEN) 이 파일에 대응하는 테스트가 없습니다. 먼저 실패하는 테스트를 쓰세요. ${how}` };
}
