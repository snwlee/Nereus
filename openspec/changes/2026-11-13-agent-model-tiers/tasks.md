# tasks — agent-model-tiers

기준선(2026-11-13, macOS): `rtk proxy npx vitest run --reporter=dot` → Tests 1 failed | 1667 passed.
기존 실패 1건: `tests/lib/coverage.test.ts` "cwd 를 트랜스크립트 디렉터리 이름으로 바꾼다". 완료 조건 "기준선에 없던 실패 0" 은 이 1건과 비교한다.
순서: T1 → T2 → T3 → T4 → T5 → T6 (T3·T4 는 T1 이 만든 테스트 파일에 덧붙인다).
편집은 "찾을 문자열 → 바꿀 문자열" 로 적는다. 찾을 문자열은 리터럴이고 그 파일에 정확히 한 번 있다(2026-11-13 `grep -c` 로 확인). 예외 둘은 줄 번호로 지정한다: T3 의 review.mjs CLI 블록(220–224행), T4 의 goldfish.mjs 머리 주석(4행)과 사용 안내(280행) — 원문에 spread·꺾쇠가 있어 태스크 검사기(lint-tasks.mjs)가 플레이스홀더로 오인한다.
기준선은 위 미커밋 파일들이 있는 작업 트리(HEAD f11c8ac)에서 잰 것이다.

- [x] T1. 기준 표 `model-tiers.mjs`
  - Files: Create `plugins/nereus/skills/spec/scripts/model-tiers.mjs` · Test `tests/skills/model-tiers.test.ts`
  - Interfaces: Produces `AGENT_TIERS`, `modelsFor(size) → { reviewer, refuter, session }`, `resolveSize(size) → { size, assumed }` (export 셋. 소비자: plan.mjs·review.mjs·goldfish.mjs·테스트)
  - Steps:
    - [x] 실패 테스트 작성 `tests/skills/model-tiers.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { AGENT_TIERS, modelsFor, resolveSize } from "../../plugins/nereus/skills/spec/scripts/model-tiers.mjs";

      const ALIASES = ["haiku", "sonnet", "opus", "fable"];
      const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

      describe("model tiers", () => {
        it("every tier uses a known alias and effort", () => {
          for (const [k, t] of Object.entries(AGENT_TIERS)) {
            expect(ALIASES, k).toContain(t.model);
            expect(EFFORTS, k).toContain(t.effort);
          }
        });
        it("pins the opus agents, the security effort, and keeps economy-designer on sonnet", () => {
          expect(AGENT_TIERS["nereus/architect"].model).toBe("opus");
          expect(AGENT_TIERS["nereus/security"]).toEqual({ model: "opus", effort: "high" });
          expect(AGENT_TIERS["nereus-game/gameplay-engineer"].model).toBe("opus");
          expect(AGENT_TIERS["nereus-game/economy-designer"].model).toBe("sonnet");
        });
        it("picks per-size models, medium for missing or unknown sizes", () => {
          const mid = { reviewer: "sonnet", refuter: "opus", session: null };
          expect(modelsFor("small")).toEqual(mid);
          expect(modelsFor("medium")).toEqual(mid);
          expect(modelsFor(undefined)).toEqual(mid);
          expect(modelsFor("enormous")).toEqual(mid);
          expect(modelsFor("large")).toEqual({ reviewer: "opus", refuter: "opus", session: "fable" });
        });
        it("flags an assumed size", () => {
          expect(resolveSize("large")).toEqual({ size: "large", assumed: false });
          expect(resolveSize(undefined)).toEqual({ size: "medium", assumed: true });
          expect(resolveSize("huge")).toEqual({ size: "medium", assumed: true });
          expect(resolveSize("constructor")).toEqual({ size: "medium", assumed: true });
          expect(modelsFor("constructor")).toEqual({ reviewer: "sonnet", refuter: "opus", session: null });
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/model-tiers.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현 `plugins/nereus/skills/spec/scripts/model-tiers.mjs`:
      ```js
      // 모델 별칭의 기준 표. 배정 근거: openspec/changes/2026-11-13-agent-model-tiers/proposal.md "배정 근거"
      // 별칭 해석은 Claude Code 에 맡긴다(code.claude.com/docs/en/model-config). 버전 고정은 ANTHROPIC_DEFAULT_*_MODEL 의 일이다.
      // Claude Code 가 실제로 읽는 것은 agents/*.md frontmatter 다 — tests/skills/agent-models.test.ts 가 이 표와 대조한다.
      const t = (model, effort = "medium") => Object.freeze({ model, effort });

      export const AGENT_TIERS = Object.freeze({
        "nereus/architect": t("opus"),
        "nereus/security": t("opus", "high"),
        "nereus-game/gameplay-engineer": t("opus"),
        "nereus/app": t("sonnet"),
        "nereus/backend": t("sonnet"),
        "nereus/frontend": t("sonnet"),
        "nereus/qa": t("sonnet"),
        "nereus/researcher": t("sonnet"),
        "nereus/reviewer": t("sonnet"),
        "nereus/seo": t("sonnet"),
        "nereus/writer": t("sonnet"),
        "nereus-game/art-director": t("sonnet"),
        "nereus-game/economy-designer": t("sonnet"),
        "nereus-game/game-ux": t("sonnet"),
        "nereus-game/level-designer": t("sonnet"),
        "nereus-game/narrative-writer": t("sonnet"),
        "nereus-3d/graphics-engineer": t("sonnet"),
        "nereus-ads/ads-engineer": t("sonnet"),
        "nereus-l10n/l10n-engineer": t("sonnet"),
      });

      // 서브에이전트 호출 지점(review EGM·반박, goldfish 리뷰어)과 세션 권고.
      // 정본: openspec 스펙 spec-tool-selection 의 요구 id plan.modelTiers.
      const MID = Object.freeze({ reviewer: "sonnet", refuter: "opus", session: null });
      const BY_SIZE = Object.freeze({
        small: MID,
        medium: MID,
        large: Object.freeze({ reviewer: "opus", refuter: "opus", session: "fable" }),
      });
      // 모르는 규모는 medium 으로 보되 호출자가 알릴 수 있게 assumed 를 세운다.
      // 객체 키("constructor" 등)·문자열이 아닌 값도 모르는 값이다.
      export const resolveSize = (size) =>
        typeof size === "string" && Object.hasOwn(BY_SIZE, size) ? { size, assumed: false } : { size: "medium", assumed: true };
      export const modelsFor = (size) => BY_SIZE[resolveSize(size).size];
      ```
    - [x] 통과 확인: Run `npx vitest run tests/skills/model-tiers.test.ts` · Expected: PASS
  - Done when: `tests/skills/model-tiers.test.ts` 이 시점의 4개 PASS

- [x] T2. planWork 가 models 를 낸다
  - Files: Modify `plugins/nereus/skills/spec/scripts/plan.mjs` · Test `tests/skills/spec-plan.test.ts`
  - Interfaces: Consumes `modelsFor(size)` · Produces `planWork({ cwd, size }, deps).models`
  - Steps:
    - [x] 실패 테스트 작성 — `tests/skills/spec-plan.test.ts` 에서 찾을 문자열 `  it("carries the classify verdict through untouched", () => {` 바로 앞에 넣는다:
      ```ts
        it("attaches size-based model aliases", () => {
          expect(planWork({ cwd: "/r", size: "large" }, green).models).toEqual({ reviewer: "opus", refuter: "opus", session: "fable" });
          expect(planWork({ cwd: "/r", size: "enormous" }, brown).models).toEqual({ reviewer: "sonnet", refuter: "opus", session: null });
          expect(planWork({ cwd: "/r", size: "small" }, brown).models).toEqual(planWork({ cwd: "/r", size: "medium" }, brown).models);
        });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/spec-plan.test.ts` · Expected: FAIL (`models` undefined)
    - [x] 최소 구현 — `plan.mjs`:
      찾을 문자열 `import { classify } from "./classify.mjs";` → 바꿀 문자열:
      ```js
      import { classify } from "./classify.mjs";
      import { modelsFor } from "./model-tiers.mjs";
      ```
      찾을 문자열 ``return { size: s, ...c, ...MATRIX[`${s}:${c.kind}`] };`` → 바꿀 문자열:
      ```js
        return { size: s, ...c, ...MATRIX[`${s}:${c.kind}`], models: modelsFor(s) };
      ```
    - [x] 통과 확인: Run `npx vitest run tests/skills/spec-plan.test.ts` · Expected: PASS
  - Done when: spec-plan 테스트 전부 PASS, `node plugins/nereus/skills/spec/scripts/plan.mjs . --size large` 출력에 `"session":"fable"`

- [x] T3. review 출력에 서브에이전트 별칭과 규모
  - Files: Modify `plugins/nereus/skills/review/scripts/review.mjs` · Test `tests/skills/model-tiers.test.ts`
  - Interfaces: Consumes `modelsFor`, `resolveSize` · Produces `reviewOutput({ mode, runners, size })` (export) · CLI `--size` (plan.mjs 와 같은 방식: `process.argv.indexOf("--size")` 다음 값)
  - Steps:
    - [x] 실패 테스트 작성 — `tests/skills/model-tiers.test.ts` 에서
      찾을 문자열 `import { AGENT_TIERS, modelsFor, resolveSize } from "../../plugins/nereus/skills/spec/scripts/model-tiers.mjs";` → 바꿀 문자열:
      ```ts
      import { AGENT_TIERS, modelsFor, resolveSize } from "../../plugins/nereus/skills/spec/scripts/model-tiers.mjs";
      import { reviewOutput } from "../../plugins/nereus/skills/review/scripts/review.mjs";
      ```
      찾을 문자열 `  it("flags an assumed size", () => {` 바로 앞에 넣는다:
      ```ts
        it("review output carries subagent aliases only when EGM runs, and always the size", () => {
          const on = reviewOutput({ mode: "egm", runners: { egm: true } });
          expect(on.plan).toEqual({ egm: true });
          expect(on).toMatchObject({ egmModel: "sonnet", refuterModel: "opus", size: "medium", sizeAssumed: true });
          expect(reviewOutput({ mode: "egm", runners: { egm: true }, size: "large" })).toMatchObject({ egmModel: "opus", sizeAssumed: false });
          const off = reviewOutput({ mode: "none", runners: { egm: false }, size: "small" });
          for (const k of ["egmPersonas", "securityRefuter", "egmModel", "refuterModel"]) expect(off).not.toHaveProperty(k);
          expect(off).toMatchObject({ size: "small", sizeAssumed: false });
        });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/model-tiers.test.ts` · Expected: FAIL (`reviewOutput` 없음)
    - [x] 최소 구현 — `review.mjs`:
      찾을 문자열 `import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";` → 바꿀 문자열:
      ```js
      import { loadConfig } from "../../../hooks/scripts/lib/config.mjs";
      import { modelsFor, resolveSize } from "../../spec/scripts/model-tiers.mjs";
      ```
      찾을 문자열: 파일 끝 CLI 블록 5줄 전체 — 1행 `if (process.argv[1] && /review\.mjs$/.test(process.argv[1])) {`, 2행 `const cfg = loadConfig();`, 3행 `const plan = planRunners(cfg.secondOpinion, undefined, makeProbe());`, 4행은 `process.stdout.write(JSON.stringify({ mode: cfg.secondOpinion, plan,` 로 시작해 `+ "\n");` 로 끝나는 한 줄(EGM 이면 egmPersonas·securityRefuter 를 펼쳐 싣는 기존 출력), 5행 `}`. (4행 원문은 spread 연산자가 있어 태스크 검사기가 플레이스홀더로 오인하므로 리터럴로 싣지 않는다.)
      바꿀 문자열:
      ```js
      // 출력의 plan 키는 runners(어떤 리뷰어가 도는지)다. EGM 이 돌 때만 서브에이전트 별칭을 싣는다.
      export function reviewOutput({ mode, runners, size }) {
        const r = resolveSize(size);
        const base = { mode, plan: runners, size: r.size, sizeAssumed: r.assumed };
        if (!runners.egm) return base;
        const m = modelsFor(r.size);
        return { ...base, egmPersonas: EGM_PERSONAS, securityRefuter: SECURITY_REFUTER_PERSONA, egmModel: m.reviewer, refuterModel: m.refuter };
      }

      if (process.argv[1] && /review\.mjs$/.test(process.argv[1])) {
        const cfg = loadConfig();
        const runners = planRunners(cfg.secondOpinion, undefined, makeProbe());
        const i = process.argv.indexOf("--size");
        process.stdout.write(JSON.stringify(reviewOutput({ mode: cfg.secondOpinion, runners, size: i > -1 ? process.argv[i + 1] : undefined })) + "\n");
      }
      ```
    - [x] 통과 확인: Run `npx vitest run tests/skills/model-tiers.test.ts tests/skills/review-merge.test.ts tests/smoke/no-unwired-exports.test.ts` · Expected: PASS
  - Done when: 세 테스트 파일 PASS. EGM 이 도는 설정(기본 `secondOpinion: "egm"`)에서 `node plugins/nereus/skills/review/scripts/review.mjs --size large` 출력에 `"egmModel":"opus"`

- [x] T4. goldfish 계획에 리뷰어 별칭과 규모
  - Files: Modify `plugins/nereus/skills/goldfish/scripts/goldfish.mjs` · Test `tests/skills/model-tiers.test.ts`
  - Interfaces: Consumes `modelsFor`, `resolveSize` · Produces `planReview(target, { cwd, mode, size })` 반환의 `reviewerModel`·`size`·`sizeAssumed` · CLI `plan` 하위명령의 `--size`
  - Steps:
    - [x] 실패 테스트 작성 — `tests/skills/model-tiers.test.ts` 에서
      찾을 문자열 `import { reviewOutput } from "../../plugins/nereus/skills/review/scripts/review.mjs";` → 바꿀 문자열:
      ```ts
      import { reviewOutput } from "../../plugins/nereus/skills/review/scripts/review.mjs";
      import { planReview } from "../../plugins/nereus/skills/goldfish/scripts/goldfish.mjs";
      import fs from "node:fs";
      import os from "node:os";
      import path from "node:path";
      ```
      찾을 문자열 `  it("flags an assumed size", () => {` 바로 앞에 넣는다:
      ```ts
        it("goldfish plan carries the reviewer alias and the size", () => {
          const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gf-"));
          fs.writeFileSync(path.join(dir, "doc.md"), "# Doc\n\nbody\n");
          expect(planReview("doc.md", { cwd: dir, mode: "feature" })).toMatchObject({ reviewerModel: "sonnet", size: "medium", sizeAssumed: true });
          expect(planReview("doc.md", { cwd: dir, mode: "feature", size: "large" })).toMatchObject({ reviewerModel: "opus", sizeAssumed: false });
        });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/model-tiers.test.ts` · Expected: FAIL (`reviewerModel` undefined)
    - [x] 최소 구현 — `goldfish.mjs`:
      찾을 문자열 `import { fileURLToPath } from "node:url";` → 바꿀 문자열:
      ```js
      import { fileURLToPath } from "node:url";
      import { modelsFor, resolveSize } from "../../spec/scripts/model-tiers.mjs";
      ```
      찾을 문자열 `export function planReview(target, { cwd = process.cwd(), mode = "full" } = {}) {` → 바꿀 문자열:
      ```js
      export function planReview(target, { cwd = process.cwd(), mode = "full", size } = {}) {
        const sz = resolveSize(size);
      ```
      찾을 문자열 `    stages: stagesFor(effective).map((s) => ({ ...s, reviewers: s.reviewers.map(reviewerPaths) })),` → 바꿀 문자열:
      ```js
          stages: stagesFor(effective).map((s) => ({ ...s, reviewers: s.reviewers.map(reviewerPaths) })),
          reviewerModel: modelsFor(sz.size).reviewer,
          size: sz.size,
          sizeAssumed: sz.assumed,
      ```
      찾을 문자열 `return planReview(args[0], { cwd: process.cwd(), mode: opt(args, "--mode") ?? "full" });` → 바꿀 문자열:
      ```js
      return planReview(args[0], { cwd: process.cwd(), mode: opt(args, "--mode") ?? "full", size: opt(args, "--size") });
      ```
      280행(stderr 사용 안내 한 줄)에서 찾을 문자열 `[--mode m] |` → 바꿀 문자열 `[--mode m] [--size s] |` (이 리터럴은 파일에 한 번 있다)
      4행(머리 주석)에서 찾을 문자열 `[--mode full|feature|implementation]` → 바꿀 문자열 `[--mode full|feature|implementation] [--size small|medium|large]` (이 리터럴은 파일에 한 번 있다)
    - [x] 통과 확인: Run `npx vitest run tests/skills/model-tiers.test.ts tests/skills/goldfish.test.ts` · Expected: PASS
  - Done when: 두 테스트 파일 PASS, `node plugins/nereus/skills/goldfish/scripts/goldfish.mjs plan openspec/changes/2026-11-13-agent-model-tiers --size large` 출력에 `"reviewerModel": "opus"`

- [x] T5. 에이전트 19개 frontmatter
  - Files: Test `tests/skills/agent-models.test.ts` · Modify (opus·medium) `plugins/nereus/agents/architect.md`, `plugins/nereus-game/agents/gameplay-engineer.md` · Modify (opus·high) `plugins/nereus/agents/security.md` · Modify (sonnet·medium) `plugins/nereus/agents/app.md`, `plugins/nereus/agents/backend.md`, `plugins/nereus/agents/frontend.md`, `plugins/nereus/agents/qa.md`, `plugins/nereus/agents/researcher.md`, `plugins/nereus/agents/reviewer.md`, `plugins/nereus/agents/seo.md`, `plugins/nereus/agents/writer.md`, `plugins/nereus-game/agents/art-director.md`, `plugins/nereus-game/agents/economy-designer.md`, `plugins/nereus-game/agents/game-ux.md`, `plugins/nereus-game/agents/level-designer.md`, `plugins/nereus-game/agents/narrative-writer.md`, `plugins/nereus-3d/agents/graphics-engineer.md`, `plugins/nereus-ads/agents/ads-engineer.md`, `plugins/nereus-l10n/agents/l10n-engineer.md`
  - Interfaces: Consumes `AGENT_TIERS`
  - Steps:
    - [x] 실패 테스트 작성 `tests/skills/agent-models.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import path from "node:path";
      import { fileURLToPath } from "node:url";
      import { AGENT_TIERS } from "../../plugins/nereus/skills/spec/scripts/model-tiers.mjs";

      const PLUGINS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../plugins");

      // plugins/<플러그인>/agents/<이름>.md → 키 "<플러그인>/<이름>"
      const agentFiles = () => fs.readdirSync(PLUGINS).flatMap((p) => {
        const d = path.join(PLUGINS, p, "agents");
        return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => ({ file: path.join(d, f), key: `${p}/${f.slice(0, -3)}` })) : [];
      });
      // 첫 frontmatter 블록만 읽는다 — 본문의 --- 에 걸리지 않게 앵커를 건다.
      const frontmatter = (file: string) => {
        const m = fs.readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const out: Record<string, string> = {};
        for (const line of (m?.[1] ?? "").split(/\r?\n/)) {
          const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
          if (kv) out[kv[1]] = kv[2].trim();
        }
        return out;
      };

      describe("agent frontmatter matches the tier table", () => {
        it("the agent files and the table have the same keys", () => {
          expect(agentFiles().map((f) => f.key).sort()).toEqual(Object.keys(AGENT_TIERS).sort());
        });
        it("every agent declares the table's model and effort", () => {
          for (const { file, key } of agentFiles()) {
            const fm = frontmatter(file);
            expect({ key, model: fm.model, effort: fm.effort }).toEqual({ key, ...AGENT_TIERS[key as keyof typeof AGENT_TIERS] });
          }
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/agent-models.test.ts` · Expected: FAIL — 둘째 테스트가 첫 에이전트에서 `model: "inherit"`, `effort: undefined` 로 실패(첫째는 키가 같아 PASS)
    - [x] 구현: 19개 파일은 2026-11-13 `grep` 기준 모두 `model: inherit` 줄이 하나이고 `effort:` 줄이 없다. 각 파일에서 찾을 문자열 `model: inherit` 를 Files 의 괄호대로 바꾼다 — (sonnet·medium) 이면 두 줄 `model: sonnet` / `effort: medium`, (opus·medium) 이면 `model: opus` / `effort: medium`, (opus·high) 이면 `model: opus` / `effort: high`.
    - [x] 통과 확인: Run `npx vitest run tests/skills/agent-models.test.ts tests/skills/skill-tooling.test.ts tests/skills/prompt-audit.test.ts` · Expected: PASS
  - Done when: 세 테스트 파일 PASS, `grep -rn "model: inherit" plugins/*/agents` 0줄

- [x] T6. 스킬 문서가 별칭을 넘긴다
  - Files: Modify `plugins/nereus/skills/intake/SKILL.md`, `plugins/nereus/skills/review/SKILL.md`, `plugins/nereus/skills/goldfish/SKILL.md`, `plugins/nereus/skills/build/SKILL.md` · Test `tests/skills/model-tier-docs.test.ts`
  - Interfaces: Consumes `planWork().models`, `reviewOutput()` 의 `egmModel`·`refuterModel`·`sizeAssumed`, `planReview()` 의 `reviewerModel`·`sizeAssumed`
  - Steps:
    - [x] 실패 테스트 작성 `tests/skills/model-tier-docs.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import path from "node:path";
      import { fileURLToPath } from "node:url";

      const SKILLS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../plugins/nereus/skills");
      const read = (s: string) => fs.readFileSync(path.join(SKILLS, s, "SKILL.md"), "utf8");

      describe("skills hand model aliases to subagent calls", () => {
        it("intake explains models, the session advice and the plan line", () => {
          const t = read("intake");
          expect(t).toMatch(/\| `models` \|/);
          expect(t).toMatch(/models\.session/);
          expect(t).toMatch(/`\.nereus\/intake\.md` 1행에 `계획:/);
        });
        it("review runs with --size and launches EGM and refuter on their aliases", () => {
          const t = read("review");
          expect(t).toMatch(/review\.mjs" \[--size small\|medium\|large\]/);
          expect(t).toMatch(/model: `egmModel`/);
          expect(t).toMatch(/model: `refuterModel`/);
          expect(t).toMatch(/sizeAssumed/);
        });
        it("goldfish runs plan with --size and launches reviewers on reviewerModel", () => {
          const t = read("goldfish");
          expect(t).toMatch(/\[--size small\|medium\|large\]/);
          expect(t).toMatch(/model: `reviewerModel`/);
          expect(t).toMatch(/sizeAssumed/);
        });
        it("subagent docs state the retry rule with a sonnet floor", () => {
          for (const s of ["review", "goldfish"]) {
            expect(read(s), s).toMatch(/한 단계 아래 별칭을 명시해 한 번만 재시도/);
            expect(read(s), s).toMatch(/하한은 `sonnet`/);
            expect(read(s), s).toMatch(/degraded/);
          }
          expect(read("review")).toMatch(/반박은 재시도하지 않는다/);
          expect(read("review")).toMatch(/지적은 차단으로 남기고/);
        });
        it("build maps cost tiers to aliases", () => {
          const t = read("build");
          expect(t).toMatch(/\| 린트·재테스트 실행 \| `haiku` \(파일을 바꾸지 않는 실행만\) \|/);
          expect(t).toMatch(/haiku < sonnet < opus < fable/);
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/model-tier-docs.test.ts` · Expected: FAIL (5개)
    - [x] intake/SKILL.md — 찾을 문자열 ``| `prd` | true 면 §4 의 PRD 를 먼저 만든다 |`` → 바꿀 문자열:
      ```markdown
      | `prd` | true 면 §4 의 PRD 를 먼저 만든다 |
      | `models` | 서브에이전트 별칭 `{reviewer, refuter, session}`. review·goldfish 가 `--size` 로 같은 값을 받는다. `models.session` 이 있으면(large) "대형 작업 — 다음 단계를 시작하기 전에 `/model` 뒤에 `models.session` 값을 붙여 세션 모델을 바꿀 수 있다" 한 줄을 알리고 그대로 진행한다(묻지 않는다) |
      ```
    - [x] intake/SKILL.md — 찾을 문자열 `- 결과를 `.nereus/intake.md`에 저장: 목표, 확정된 가정, 제약, 범위 밖, 열린 질문.` → 바꿀 문자열:
      ```markdown
      - 결과를 `.nereus/intake.md`에 저장: 목표, 확정된 가정, 제약, 범위 밖, 열린 질문.
      - `.nereus/intake.md` 1행에 `계획:` 으로 시작하는 한 줄을 쓴다(예: `계획: medium · brownfield · openspec`). 제목은 그 아래에 둔다. `--quick` 이어도 쓰고, 매 intake 가 파일을 덮어쓴다. review·goldfish 는 이 줄의 첫 값(size)을 `--size` 로 넘긴다.
      ```
    - [x] review/SKILL.md — 찾을 문자열 `node "${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/review.mjs"` → 바꿀 문자열 `node "${CLAUDE_PLUGIN_ROOT}/skills/review/scripts/review.mjs" [--size small|medium|large]`
    - [x] review/SKILL.md — 찾을 문자열 `EGM 이 계획되면 출력에 `egmPersonas`(goldfish 페르소나 절대 경로)가 함께 나온다.` → 바꿀 문자열(독립 문단 두 개, 사이에 빈 줄):
      ```markdown
      EGM 이 계획되면 출력에 `egmPersonas`(goldfish 페르소나 절대 경로)와 서브에이전트 별칭 `egmModel`·`refuterModel` 이 함께 나온다.
      `--size` 는 `.nereus/intake.md` 1행 `계획:` 의 첫 값이다. 그 줄이 없거나 지금 작업의 것이라는 확신이 없으면 빼고 돌린다 — 출력의 `sizeAssumed` 가 true 면 "규모를 몰라 medium 으로 봤다" 한 줄을 알린다.

      별칭을 쓸 수 없을 때(`Agent` 오류가 모델을 알 수 없음·사용 불가·허용 안 됨이라고 말할 때만):
      - EGM: 별칭 순서(haiku < sonnet < opus < fable)에서 한 단계 아래 별칭을 명시해 한 번만 재시도한다. 하한은 `sonnet` 이다. 끝내 못 쓰면 EGM 을 `skipped` 로 알리고 게이트는 OCR 결과로 판정한다. large 에서 sonnet 으로 내려가 돌았으면 보고서의 그 리뷰어에 `degraded` 를 붙인다.
      - 반박은 재시도하지 않는다. `refuterModel` 로 못 돌면 반박하지 않은 것으로 둔다 — 지적은 차단으로 남기고 보고서에 `degraded` 를 붙인다. 풀려면 opus 를 쓸 수 있는 세션에서 반박을 다시 돌리거나, 사용자가 수용·기각하고 그 결정을 `.nereus/review.md` 에 기록한다.
      ```
    - [x] review/SKILL.md — 찾을 문자열 ``- **EGM (기본 2차 의견)**: `Agent`(general-purpose) 서브에이전트를`` → 바꿀 문자열 ``- **EGM (기본 2차 의견)**: `Agent`(general-purpose, model: `egmModel`) 서브에이전트를``
    - [x] review/SKILL.md — 찾을 문자열 ``항목마다 `Agent`(general-purpose)를`` → 바꿀 문자열 ``항목마다 `Agent`(general-purpose, model: `refuterModel`)를``
    - [x] goldfish/SKILL.md — 찾을 문자열 `[--mode full|feature|implementation]` (§1 bash 블록, 한 번 있음) → 바꿀 문자열 `[--mode full|feature|implementation] [--size small|medium|large]`
    - [x] goldfish/SKILL.md — 찾을 문자열 ``출력의 `feature`·`detailed`(범위), `context.inside`(리뷰어에게 줄 파일), `stages`(단계별 리뷰어·페르소나·표준 절대 경로), `notes` 를 그대로 쓴다.`` → 바꿀 문자열:
      ```markdown
      출력의 `feature`·`detailed`(범위), `context.inside`(리뷰어에게 줄 파일), `stages`(단계별 리뷰어·페르소나·표준 절대 경로), `notes` 를 그대로 쓴다.
      `--size` 는 `.nereus/intake.md` 1행 `계획:` 의 첫 값이다. 없거나 확신이 없으면 빼고 돌린다 — `sizeAssumed` 가 true 면 "규모를 몰라 medium 으로 봤다" 한 줄을 알린다. 출력의 `reviewerModel` 이 리뷰어 서브에이전트의 별칭이다.
      ```
    - [x] goldfish/SKILL.md — 찾을 문자열 ``Agent` 도구, `subagent_type: general-purpose`.`` → 바꿀 문자열:
      ```markdown
      `Agent` 도구, `subagent_type: general-purpose`, model: `reviewerModel`. 모델 오류(알 수 없음·사용 불가·허용 안 됨)일 때만 별칭 순서(haiku < sonnet < opus < fable)에서 한 단계 아래 별칭을 명시해 한 번만 재시도한다. 하한은 `sonnet` 이다. 내려가 돌았으면 단계 보고서의 그 리뷰어 행에 `degraded` 를 붙이고, 끝내 못 쓰면 아래 규칙대로 `not run` 이다.
      ```
    - [x] build/SKILL.md — 찾을 문자열(§5 표와 그 아래 한 줄):
      ```markdown
      | 작업 등급 | 예 | 티어 |
      |---|---|---|
      | 기계적 (mechanical) | 포맷·린트·재테스트·단순 수정 | 가장 낮은 가용 티어 |
      | 통합 (integration) | 다파일 기능 구현·리뷰 반영 | 표준 티어 |
      | 설계·최종판단 (design/final) | 아키텍처 결정·R4–5 escalate·breaker 판정 | 가장 높은 티어 |

      fix 4라운드 이후는 무조건 한 티어 위로 올린다 (고친 주체가 자기 문제를 못 본다).
      ```
      바꿀 문자열:
      ```markdown
      | 작업 등급 | 예 | 티어 (모델 별칭) |
      |---|---|---|
      | 기계적 (mechanical) | 린트·재테스트 실행 | `haiku` (파일을 바꾸지 않는 실행만) |
      | 통합 (integration) | 다파일 기능 구현·리뷰 반영·포맷·단순 수정 | 담당 에이전트 frontmatter 의 `model` |
      | 설계·최종판단 (design/final) | 아키텍처 결정·R4–5 escalate·breaker 판정 | `opus` 이상 |

      별칭 순서는 haiku < sonnet < opus < fable 이다. 담당 에이전트 기준값은 `skills/spec/scripts/model-tiers.mjs` 의 `AGENT_TIERS`.
      fix 4라운드 이후는 무조건 고친 주체의 별칭보다 한 단계 높은 별칭으로 올린다 (고친 주체가 자기 문제를 못 본다).
      ```
    - [x] 통과 확인: Run `npx vitest run tests/skills/model-tier-docs.test.ts tests/skills/build-tier.test.ts tests/skills/build-contract.test.ts tests/skills/review-channels.test.ts tests/skills/goldfish.test.ts tests/skills/skill-tooling.test.ts` · Expected: PASS
  - Done when: 여섯 테스트 파일 PASS, 전체 스위트 `rtk proxy npx vitest run --reporter=dot` 에서 기준선에 없던 실패 0

## Global Constraints
- 플러그인 런타임은 Node 표준 라이브러리만.
- 별칭만(`haiku`·`sonnet`·`opus`·`fable`). 버전 ID 금지. 등급 값의 기준은 `model-tiers.mjs` — 예외: 테스트 기대값, 에이전트 frontmatter, 문서 문구.
- 이 변경이 시작되기 전에 이미 수정돼 있던 파일은 건드리지 않는다: `docs/research/2026-09-09-ulw-gap.md`, `plugins/nereus-game/lib/balance-sim.mjs`, `plugins/nereus-game/profiles/casual-puzzle.json`, `plugins/nereus/skills/image/scripts/__pycache__/gemini_cli.cpython-314.pyc`, `tests/lib/balance-sim-lives.test.ts`, `tests/lib/coverage.test.ts`, `openspec/changes/2026-09-15-add-balance-lives-axis/`. 이 변경 자신의 디렉터리(`openspec/changes/2026-11-13-agent-model-tiers/`)는 예외.
