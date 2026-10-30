# design-motion Specification

## Purpose
화면으로는 안 보이는 모션 실수를 코드에서 결정적으로 잡고, 방향 비평에 레퍼런스 이미지를 실어 보낸다.
모션 검사는 권고다 — 취향으로 사람을 막지 않는다는 design 게이트 원칙을 따른다.

## ADDED Requirements

### Requirement: diff 추가 줄의 모션 실수를 규칙으로 잡아야 한다
<!-- id: design-motion.rules -->
<!-- entities: MotionCheck -->
<!-- enforced: tests/skills/design-motion.test.ts -->

The system MUST satisfy the following. `checkMotion(diff)` 는 unified diff 에서 확장자가 css·scss·sass·less·tsx·jsx·vue·svelte·astro·html 인 파일의
**추가 줄(`+`)만** 보고 `{ file, line, rule, message }` 배열을 내야 한다. `line` 은 새 파일 기준 줄 번호다. 규칙:
`transition-all`(`transition: all` 또는 클래스 `transition-all`), `layout-prop`(transition 값·transition-property·`transition-[…]` 에 width·height·top·left·right·bottom·margin·padding),
`scale-zero`(`scale(0)` 또는 클래스 `scale-0`), `ease-in`(`ease-in` 이지만 `ease-in-out` 아님),
`long-duration`(transition·animation·duration 이 있는 줄의 ms 값 > 500, s 값 > 0.5, 클래스 `duration-N` 의 N > 500),
`no-reduced-motion`(파일당 1회: 추가 줄에 transition·animation·@keyframes·`animate-` 가 있는데 그 파일 diff 어디에도 `prefers-reduced-motion`·`motion-reduce:`·`motion-safe:`·`useReducedMotion` 이 없음, 줄은 첫 모션 줄).
삭제 줄·문맥 줄·대상 외 확장자는 보지 않는다.

#### Scenario: transition all
- **WHEN** `+  transition: all 300ms ease;` 가 `src/a.css` 5번째 줄에 추가
- **THEN** `{ file: "src/a.css", line: 5, rule: "transition-all" }` 가 있다

#### Scenario: ease-in-out 은 통과
- **WHEN** `+  transition: transform 200ms ease-in-out;`
- **THEN** `ease-in` 규칙이 없다

#### Scenario: reduced-motion 이 있으면 통과
- **WHEN** 같은 파일 diff 에 `@media (prefers-reduced-motion: reduce)` 가 있다
- **THEN** `no-reduced-motion` 이 없다

#### Scenario: 삭제 줄은 무시
- **WHEN** `-  transition: all 1s;`
- **THEN** 결과가 비어 있다

### Requirement: 모션 검사는 권고이고 strict 일 때만 실패해야 한다
<!-- id: design-motion.cli -->
<!-- entities: MotionCheck -->
<!-- enforced: tests/skills/design-motion.test.ts -->

The system MUST satisfy the following. `motionReport(findings)` 는 규칙별로 묶은 마크다운을 내고, 없으면 "모션 지적 없음" 을 포함한다.
CLI `motion-check.mjs [--base REF] [--strict]` 는 지적이 있어도 종료코드 0 이고 `--strict` 일 때만 1 이다.

#### Scenario: 보고서
- **WHEN** `motionReport([])`
- **THEN** "모션 지적 없음" 포함

### Requirement: 방향 비평에 레퍼런스 이미지를 첨부할 수 있어야 한다
<!-- id: design-motion.refs -->
<!-- entities: DesignFeedback -->
<!-- enforced: tests/skills/design-feedback.test.ts -->

The system MUST satisfy the following. `planRunner({ phase: "direction", refImages })` 는 웹세션 경로에서 이미지마다 `--file <path>` 를 붙이고,
`refImages` 가 있는데 python3 가 없으면 agy 로 내려가지 않고 `error` 를 내야 한다(agy 는 이미지 첨부 불가).
`directionPrompt({ refImages })` 는 이미지가 있으면 "첨부 레퍼런스" 절에 파일 이름을 나열하고 "무엇을 가져오고 무엇을 버리는지" 대조 항목을 넣는다.
`validRefImages(paths, exists)` 는 확장자가 png·jpg·jpeg·webp 이고 존재하는 것만 통과시키고, 나머지는 `rejected` 로 이유와 함께 돌려준다.

#### Scenario: 첨부
- **WHEN** `planRunner({ phase: "direction", promptFile: "p", refImages: ["a.png","b.jpg"], has: () => true })`
- **THEN** args 에 `--file a.png`, `--file b.jpg`

#### Scenario: agy 로 내려가지 않는다
- **WHEN** python3 없음, agy 있음, refImages 1장
- **THEN** `error` 가 있고 `agy` 를 언급

#### Scenario: 형식 검사
- **WHEN** `validRefImages(["a.png","b.gif","c.webp"], (p) => p !== "c.webp")`
- **THEN** `ok` 가 `["a.png"]`, `rejected` 2건
