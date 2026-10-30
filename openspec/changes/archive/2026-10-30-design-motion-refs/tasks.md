# tasks — design-motion-refs

테스트는 저장소 루트에서 `npx vitest run <패턴>`. 스크립트 루트 `plugins/nereus/skills/design/scripts`.

- [x] T1. 모션 정적 검사 — 규칙과 보고서 [wave:1]
  - Files: Create `plugins/nereus/skills/design/scripts/motion-check.mjs` · Test `tests/skills/design-motion.test.ts`
  - Interfaces: Consumes 없음 · Produces `checkMotion(diff: string): Finding[]`, `motionReport(findings: Finding[]): string`, `MOTION_RULES` (Finding = `{file, line, rule, message}`)
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect } from "vitest";
      import { checkMotion, motionReport, MOTION_RULES } from "../../plugins/nereus/skills/design/scripts/motion-check.mjs";

      const diff = (file: string, added: string[], { start = 1, extra = [] as string[] } = {}) => [
        `diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`,
        `@@ -${start},0 +${start},${added.length + extra.length} @@`,
        ...extra, ...added.map((l) => `+${l}`),
      ].join("\n");
      const rules = (d: string) => checkMotion(d).map((f) => f.rule);

      describe("design-motion.rules", () => {
        it("transition all — 파일·줄 번호", () => {
          const f = checkMotion(diff("src/a.css", [".a {", "  transition: all 300ms ease;", "}"], { start: 4 }));
          expect(f).toContainEqual(expect.objectContaining({ file: "src/a.css", line: 5, rule: "transition-all" }));
        });
        it("tailwind 클래스 transition-all·scale-0·duration-700", () => {
          const r = rules(diff("src/A.tsx", ['<div className="transition-all scale-0 duration-700 motion-reduce:transition-none" />']));
          expect(r).toEqual(expect.arrayContaining(["transition-all", "scale-zero", "long-duration"]));
          expect(r).not.toContain("no-reduced-motion");
        });
        it("레이아웃 속성 전환", () => {
          expect(rules(diff("a.css", ["  transition: width 200ms ease-out, opacity 200ms;"]))).toContain("layout-prop");
          expect(rules(diff("a.css", ["  transition-property: margin-left;"]))).toContain("layout-prop");
          expect(rules(diff("A.tsx", ['<i className="transition-[height] duration-200" />']))).toContain("layout-prop");
          expect(rules(diff("a.css", ["  transition: transform 200ms ease-out;"]))).not.toContain("layout-prop");
        });
        it("scale(0)", () => {
          expect(rules(diff("a.css", ["  transform: scale(0);"]))).toContain("scale-zero");
          expect(rules(diff("a.css", ["  transform: scale(0.95);"]))).not.toContain("scale-zero");
        });
        it("ease-in 은 잡고 ease-in-out 은 통과", () => {
          expect(rules(diff("a.css", ["  transition: opacity 200ms ease-in;"]))).toContain("ease-in");
          expect(rules(diff("a.css", ["  transition: transform 200ms ease-in-out;"]))).not.toContain("ease-in");
        });
        it("길이 — 500ms 초과·0.5s 초과", () => {
          expect(rules(diff("a.css", ["  transition: opacity 600ms ease-out;"]))).toContain("long-duration");
          expect(rules(diff("a.css", ["  animation: spin 1.2s linear infinite;"]))).toContain("long-duration");
          expect(rules(diff("a.css", ["  transition: opacity 200ms ease-out;"]))).not.toContain("long-duration");
        });
        it("reduced-motion — 없으면 파일당 한 번, 있으면 통과", () => {
          const none = checkMotion(diff("a.css", ["  transition: opacity 200ms ease-out;", "  animation: fade 200ms ease-out;"]));
          expect(none.filter((f) => f.rule === "no-reduced-motion")).toHaveLength(1);
          const ok = diff("a.css", ["  transition: opacity 200ms ease-out;"], { extra: [" @media (prefers-reduced-motion: reduce) { * { transition: none } }"] });
          expect(rules(ok)).not.toContain("no-reduced-motion");
        });
        it("삭제 줄·대상 외 확장자는 무시", () => {
          expect(checkMotion(["diff --git a/a.css b/a.css", "+++ b/a.css", "@@ -1,1 +0,0 @@", "-  transition: all 1s;"].join("\n"))).toEqual([]);
          expect(checkMotion(diff("a.ts", ["const s = 'transition: all 1s';"]))).toEqual([]);
        });
      });

      describe("design-motion.cli", () => {
        it("보고서", () => {
          expect(motionReport([])).toContain("모션 지적 없음");
          const md = motionReport([{ file: "a.css", line: 3, rule: "transition-all", message: "m" }]);
          expect(md).toContain("transition-all");
          expect(md).toContain("a.css:3");
        });
        it("규칙마다 설명이 있다", () => {
          for (const r of ["transition-all", "layout-prop", "scale-zero", "ease-in", "long-duration", "no-reduced-motion"])
            expect(MOTION_RULES[r]).toBeTruthy();
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/design-motion.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: diff 를 파일 단위로 나눠(`+++ b/` 로 파일, `@@ … +N,` 으로 줄 번호 시작, `+`·` ` 줄마다 번호 증가, `-` 는 증가 없음) 대상 확장자의 `+` 줄에 규칙 정규식 적용. reduced-motion 은 파일의 `+`·문맥 줄 전체에서 탐지. `MOTION_RULES` 는 규칙 → 한국어 설명·고치는 법
    - [x] 통과 확인: Run `npx vitest run tests/skills/design-motion.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `design-motion.test.ts` 10 케이스 PASS

- [x] T2. 방향 비평 레퍼런스 이미지 [wave:1]
  - Files: Modify `plugins/nereus/skills/design/scripts/design-feedback.mjs` · Test `tests/skills/design-feedback.test.ts`
  - Interfaces: Consumes 기존 `planRunner`·`directionPrompt` · Produces `planRunner({phase:"direction", refImages})`, `directionPrompt({refImages})`, `validRefImages(paths: string[], exists?: (p: string) => boolean): {ok: string[], rejected: {path: string, reason: string}[]}`, export `collectDiff`
  - Steps:
    - [x] 실패 테스트 작성 (`tests/skills/design-feedback.test.ts` 끝에 추가, import 에 `validRefImages` 추가):
      ```ts
      describe("design-motion.refs", () => {
        it("웹세션 경로에 이미지마다 --file", () => {
          const p = planRunner({ phase: "direction", promptFile: "p", refImages: ["a.png", "b.jpg"], has: () => true });
          expect(p.args.join(" ")).toContain("--file a.png");
          expect(p.args.join(" ")).toContain("--file b.jpg");
        });
        it("이미지가 있으면 agy 로 내려가지 않는다", () => {
          const p = planRunner({ phase: "direction", promptFile: "p", refImages: ["a.png"], has: (b: string) => b === "agy" });
          expect(p.error).toMatch(/agy/);
        });
        it("이미지가 없으면 기존처럼 agy 폴백", () => {
          expect(planRunner({ phase: "direction", promptFile: "p", has: (b: string) => b === "agy" }).bin).toBe("agy");
        });
        it("프롬프트에 첨부 레퍼런스와 대조 항목", () => {
          const p = directionPrompt({ brief: "b", refImages: ["/x/stripe-hero.png"] });
          expect(p).toContain("첨부 레퍼런스");
          expect(p).toContain("stripe-hero.png");
          expect(p).toMatch(/가져오고.*버리/);
          expect(directionPrompt({ brief: "b" })).not.toContain("첨부 레퍼런스");
        });
        it("형식·존재 검사", () => {
          const r = validRefImages(["a.png", "b.gif", "c.webp"], (p: string) => p !== "c.webp");
          expect(r.ok).toEqual(["a.png"]);
          expect(r.rejected.map((x) => x.path)).toEqual(["b.gif", "c.webp"]);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/design-feedback.test.ts` · Expected: FAIL (validRefImages 없음)
    - [x] 최소 구현: `validRefImages` 는 `/\.(png|jpe?g|webp)$/i` 와 `exists` 로 나눈다. `directionPrompt` 에 `refImages = []` 인자와 절 추가. `planRunner` direction: `refImages.length && !has("python3")` 면 error, 웹세션 args 에 `--file` 반복. CLI `direction`·`prompt direction` 에서 `flags(argv, "--ref-image")` → `validRefImages(…, fs.existsSync)` → rejected 가 있으면 stderr 로 알리고 종료코드 2. `collectDiff` 앞에 export
    - [x] 통과 확인: Run `npx vitest run tests/skills/design-feedback.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `design-feedback.test.ts` 전부 PASS (기존 케이스 포함)

- [x] T3. 모션 검사 CLI [flow]
  - Files: Modify `plugins/nereus/skills/design/scripts/motion-check.mjs` · Test `tests/skills/design-motion-cli.test.ts`
  - Interfaces: Consumes `collectDiff` (T2) · Produces CLI `node motion-check.mjs [--base REF] [--strict]`
  - Steps:
    - [x] 실패 테스트 작성:
      ```ts
      import { describe, it, expect, beforeAll } from "vitest";
      import { spawnSync, execFileSync } from "node:child_process";
      import { mkdtempSync, writeFileSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { join } from "node:path";

      const CLI = join(process.cwd(), "plugins/nereus/skills/design/scripts/motion-check.mjs");
      let repo = "";
      const git = (...a: string[]) => execFileSync("git", a, { cwd: repo });
      const run = (args: string[]) => spawnSync("node", [CLI, ...args], { cwd: repo, encoding: "utf8", env: { ...process.env, NEREUS_HOME: repo } });

      beforeAll(() => {
        repo = mkdtempSync(join(tmpdir(), "motion-"));
        git("init", "-q");
        git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init");
        writeFileSync(join(repo, "a.css"), ".a {\n  transition: all 300ms ease-in;\n}\n");
      });

      describe("design-motion.cli [flow]", () => {
        it("미커밋 새 파일의 지적을 보고하고 0 으로 끝난다", () => {
          const r = run([]);
          expect(r.status, r.stderr).toBe(0);
          expect(r.stdout).toContain("transition-all");
          expect(r.stdout).toContain("a.css:2");
        });
        it("--strict 면 1", () => {
          expect(run(["--strict"]).status).toBe(1);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/design-motion-cli.test.ts` · Expected: FAIL (CLI 진입점 없음)
    - [x] 최소 구현: main 가드(`process.argv[1]` 이 이 파일) 에서 `collectDiff(process.cwd(), base)` → `checkMotion` → `motionReport` 출력, `--strict` 이고 지적이 있으면 exit 1
    - [x] 통과 확인: Run `npx vitest run tests/skills/design-motion-cli.test.ts` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `design-motion-cli.test.ts` 2 케이스 PASS

- [x] T4. 문서 — design SKILL·frontend 에이전트·setup
  - Files: Modify `plugins/nereus/skills/design/SKILL.md` · Modify `plugins/nereus/agents/frontend.md` · Modify `plugins/nereus/skills/setup/SKILL.md`
  - Interfaces: Consumes T1~T3 · Produces 문서
  - Steps:
    - [x] design SKILL.md: 1단계에 `--ref-image` (Figma 는 전역 figma 스킬/Figma MCP 로 프레임 스크린샷을 떠서 넘긴다), 2단계 뒤에 "모션 검사" 절(6 규칙 표, 권고·`--strict`, 정지 스크린샷으로는 모션을 못 본다는 이유, Emil 원칙 출처)
    - [x] frontend.md 규칙에 "모션을 만졌으면 `motion-check.mjs` 를 돌리고 지적을 반영하거나 이유를 남긴다" 한 줄, 출력 계약에 모션 검사 결과
    - [x] setup SKILL.md 동반 목록에 `npx skills@latest add emilkowalski/skills` — `review-animations` 는 사람이 `/review-animations` 로 부른다(disable-model-invocation)
    - [x] 확인: Run `npx vitest run` · Expected: PASS
    - [x] 커밋: finish 단계에서 일괄
  - Done when: `grep -c "motion-check" plugins/nereus/skills/design/SKILL.md plugins/nereus/agents/frontend.md` 둘 다 ≥ 1, 전체 테스트 PASS

## Global Constraints
- Node 20+ 표준 라이브러리만. 순수 모듈은 입력을 변경하지 않는다. 파일 300줄 이하(design-feedback.mjs 는 기존 366줄 — 이번 변경으로 크게 늘리지 않는다).
- 모션 검사는 권고 — design 게이트(finish)를 막지 않는다. 차단 축(a11y·hierarchy·states)은 바꾸지 않는다.
- 테스트는 임시 디렉터리와 `NEREUS_HOME` 격리, 네트워크 없음.
- 기존 미커밋 변경(balance-sim 등)은 건드리지 않는다.
