# tasks — add-session-handoff

- [x] T1. paths.mjs — 세션 handoff 경로 결정 (순수)
  - Files: Modify `plugins/nereus/hooks/scripts/lib/paths.mjs` · Test `tests/lib/paths.test.ts`
  - Interfaces: Produces `handoffDir(cwd): string` · `handoffFileName({ now, sessionId }): string` · `sessionHandoffPath({ cwd, sessionId, now, entries }): string`. Consumes `projectStateDir(cwd)` (기존).
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/lib/paths.test.ts` 끝에 추가:
      ```ts
      import { handoffDir, handoffFileName, sessionHandoffPath } from "../../plugins/nereus/hooks/scripts/lib/paths.mjs";

      describe("session handoff path", () => {
        const now = new Date("2026-09-12T14:30:00").getTime();
        it("names a file by session start time and the first 8 chars of the session id", () => {
          expect(handoffFileName({ now, sessionId: "a1b2c3d4-e5f6-7890-aaaa-bbbbbbbbbbbb" })).toBe("20260912-1430-a1b2c3d4.md");
        });
        it("falls back to nosession when the session id is missing", () => {
          expect(handoffFileName({ now, sessionId: undefined })).toBe("20260912-1430-nosessio.md");
        });
        it("puts session handoffs under .nereus/handoff", () => {
          expect(handoffDir("/repo")).toBe(path.join("/repo", ".nereus", "handoff"));
        });
        it("creates a new path when no file of this session exists", () => {
          const p = sessionHandoffPath({ cwd: "/repo", sessionId: "a1b2c3d4xx", now, entries: [{ name: "20260911-0900-99999999.md", mtimeMs: 1 }] });
          expect(p).toBe(path.join("/repo", ".nereus", "handoff", "20260912-1430-a1b2c3d4.md"));
        });
        it("reuses this session's existing file after a compact", () => {
          const p = sessionHandoffPath({ cwd: "/repo", sessionId: "a1b2c3d4xx", now, entries: [{ name: "20260912-0900-a1b2c3d4.md", mtimeMs: 1 }] });
          expect(p).toBe(path.join("/repo", ".nereus", "handoff", "20260912-0900-a1b2c3d4.md"));
        });
      });
      ```
      `sessionId` 가 없으면 식별자는 `"nosession".slice(0, 8)` = `nosessio` 다. 기대값의 리터럴이 그 규칙을 고정한다.
    - [ ] 실패 확인: Run `npx vitest run tests/lib/paths.test.ts` · Expected: FAIL (`handoffDir` is not a function)
    - [ ] 최소 구현 — `paths.mjs` 에 추가(기존 `handoffPath` 는 레거시 폴백으로 남긴다):
      ```js
      export function handoffDir(cwd) {
        return path.join(projectStateDir(cwd), "handoff");
      }

      const sid8 = (sessionId) => String(sessionId || "nosession").slice(0, 8);

      /** 파일명의 시각은 세션 **시작** 시각이다. 최신 판정에는 쓰지 않는다(mtime 을 쓴다). */
      export function handoffFileName({ now = Date.now(), sessionId } = {}) {
        const d = new Date(now);
        const p2 = (n) => String(n).padStart(2, "0");
        const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
        return `${stamp}-${sid8(sessionId)}.md`;
      }

      /**
       * 이 세션이 쓸 경로. compact 는 같은 세션이므로 같은 sid8 파일이 있으면 그것을 재사용한다.
       * 없으면 새 이름을 만든다. 부수 효과 없음 — 파일을 만들지 않는다.
       */
      export function sessionHandoffPath({ cwd, sessionId, now = Date.now(), entries = [] } = {}) {
        const mine = entries.find((e) => e.name.endsWith(`-${sid8(sessionId)}.md`));
        return path.join(handoffDir(cwd), mine ? mine.name : handoffFileName({ now, sessionId }));
      }
      ```
    - [ ] 통과 확인: Run `npx vitest run tests/lib/paths.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/hooks/scripts/lib/paths.mjs tests/lib/paths.test.ts && git commit -m "feat(baton): 세션별 handoff 경로 계산"`
  - Done when: `npx vitest run tests/lib/paths.test.ts` 통과, 기존 `handoffPath` 테스트도 그대로 통과

- [x] T2. paths.mjs — 최신 선택·다른 세션 감지·정리 계획 (순수)
  - Files: Modify `plugins/nereus/hooks/scripts/lib/paths.mjs` · Test `tests/lib/paths.test.ts`
  - Interfaces: Consumes `handoffDir(cwd)` (T1) · Produces `latestHandoff({ cwd, entries, legacyExists }): string | null` · `recentOtherSessions({ entries, sessionId, now, windowMs }): Entry[]` · `planHandoffPrune({ entries, now, keep, maxAgeMs, protect }): string[]`. `Entry` 는 `{ name: string, mtimeMs: number }`.
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/lib/paths.test.ts` 에 추가:
      ```ts
      import { latestHandoff, recentOtherSessions, planHandoffPrune } from "../../plugins/nereus/hooks/scripts/lib/paths.mjs";

      const MIN = 60_000;
      describe("handoff selection", () => {
        const now = 1_000 * MIN;
        it("picks the newest by mtime, not by file name", () => {
          const entries = [
            { name: "20260912-1400-bbbbbbbb.md", mtimeMs: now - 20 * MIN },
            { name: "20260912-0900-aaaaaaaa.md", mtimeMs: now - 2 * MIN },
          ];
          expect(latestHandoff({ cwd: "/repo", entries })).toBe(path.join("/repo", ".nereus", "handoff", "20260912-0900-aaaaaaaa.md"));
        });
        it("breaks an mtime tie by file name descending", () => {
          const entries = [
            { name: "20260912-0900-aaaaaaaa.md", mtimeMs: now },
            { name: "20260912-1400-bbbbbbbb.md", mtimeMs: now },
          ];
          expect(latestHandoff({ cwd: "/repo", entries })).toContain("20260912-1400-bbbbbbbb.md");
        });
        it("falls back to the legacy single file when the directory is empty", () => {
          expect(latestHandoff({ cwd: "/repo", entries: [], legacyExists: true })).toBe(path.join("/repo", ".nereus", "handoff.md"));
        });
        it("returns null when there is nothing to read", () => {
          expect(latestHandoff({ cwd: "/repo", entries: [], legacyExists: false })).toBeNull();
        });
        it("reports other sessions that wrote within the window, newest first", () => {
          const entries = [
            { name: "20260912-1400-aaaaaaaa.md", mtimeMs: now - 1 * MIN },
            { name: "20260912-1300-bbbbbbbb.md", mtimeMs: now - 5 * MIN },
            { name: "20260912-0100-cccccccc.md", mtimeMs: now - 90 * MIN },
          ];
          const out = recentOtherSessions({ entries, sessionId: "aaaaaaaa", now, windowMs: 30 * MIN });
          expect(out.map((e) => e.name)).toEqual(["20260912-1300-bbbbbbbb.md"]);
        });
        it("keeps the 10 newest and drops what is older than the max age", () => {
          const many = Array.from({ length: 12 }, (_, i) => ({ name: `2026091${i % 10}-0900-s${i}0000000`.slice(0, 22) + ".md", mtimeMs: now - i * MIN }));
          const dropped = planHandoffPrune({ entries: many, now, keep: 10, maxAgeMs: 30 * 24 * 60 * MIN, protect: [] });
          expect(dropped).toHaveLength(2);
          expect(dropped).toContain(many[11].name);
        });
        it("never drops a protected file", () => {
          const entries = [
            { name: "20260912-1400-aaaaaaaa.md", mtimeMs: now - 400 * 24 * 60 * MIN },
            { name: "20260912-1300-bbbbbbbb.md", mtimeMs: now },
          ];
          const dropped = planHandoffPrune({ entries, now, keep: 1, maxAgeMs: MIN, protect: ["20260912-1400-aaaaaaaa.md"] });
          expect(dropped).toEqual([]);
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/paths.test.ts` · Expected: FAIL (`latestHandoff` is not a function)
    - [ ] 최소 구현 — `paths.mjs` 에 추가:
      ```js
      // 최신은 mtime 으로 정한다. 파일명의 시각은 세션 시작 시각이라 마지막 쓰기 순서와 다르다.
      const byNewest = (a, b) => (b.mtimeMs - a.mtimeMs) || b.name.localeCompare(a.name);

      export function latestHandoff({ cwd, entries = [], legacyExists = false } = {}) {
        const sorted = [...entries].sort(byNewest);
        if (sorted.length) return path.join(handoffDir(cwd), sorted[0].name);
        return legacyExists ? handoffPath(cwd) : null;
      }

      export function recentOtherSessions({ entries = [], sessionId, now = Date.now(), windowMs = 30 * 60 * 1000 } = {}) {
        const mine = `-${sid8(sessionId)}.md`;
        return entries
          .filter((e) => !e.name.endsWith(mine) && now - e.mtimeMs <= windowMs)
          .sort(byNewest);
      }

      /** 삭제할 파일명만 돌려준다. 지우는 것은 호출자 몫이다(순수 유지). */
      export function planHandoffPrune({ entries = [], now = Date.now(), keep = 10, maxAgeMs = 30 * 24 * 60 * 60 * 1000, protect = [] } = {}) {
        const safe = new Set(protect);
        const sorted = [...entries].sort(byNewest);
        return sorted
          .filter((e, i) => !safe.has(e.name) && (i >= keep || now - e.mtimeMs > maxAgeMs))
          .map((e) => e.name);
      }
      ```
    - [ ] 통과 확인: Run `npx vitest run tests/lib/paths.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/hooks/scripts/lib/paths.mjs tests/lib/paths.test.ts && git commit -m "feat(baton): handoff 최신 선택·동시 세션 감지·정리 계획"`
  - Done when: 위 7개 테스트 전부 통과

- [ ] T3. session-start 훅 배선 [wave:1]
  - Files: Modify `plugins/nereus/hooks/scripts/session-start.mjs` · Test `tests/hooks/session-start.test.ts`
  - Interfaces: Consumes `sessionHandoffPath`·`latestHandoff`·`recentOtherSessions`·`planHandoffPrune` (T1·T2) · Produces `handle(input, deps)` 확장 — 새 deps `entries(dir)` → `Entry[]`, `removeFile(path)`, `env` (환경변수 맵).
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/hooks/session-start.test.ts` 에 추가:
      ```ts
      const MIN = 60_000;
      const at = (ms: number) => ({ mtimeMs: ms });
      it("tells this session which handoff file it owns", () => {
        const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({ entries: () => [], now: () => new Date("2026-09-12T14:30:00").getTime() }));
        const ctx = out!.hookSpecificOutput.additionalContext;
        expect(ctx).toContain(".nereus/handoff/20260912-1430-a1b2c3d4.md");
        expect(ctx).toContain("여기에만");
      });
      it("injects the newest handoff from the session directory", () => {
        const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "clear" }, deps({
          files: { "/r/.nereus/handoff/20260912-0900-99999999.md": "# Handoff\n목표: 이전 세션" },
          entries: () => [{ name: "20260912-0900-99999999.md", ...at(Date.now() - 90 * MIN) }],
        }));
        expect(out!.hookSpecificOutput.additionalContext).toContain("목표: 이전 세션");
      });
      it("still reads the legacy single file when the directory is empty", () => {
        const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "clear" }, deps({
          files: { "/r/.nereus/handoff.md": "# Handoff\n목표: 레거시" },
          entries: () => [],
        }));
        expect(out!.hookSpecificOutput.additionalContext).toContain("목표: 레거시");
      });
      it("warns when another session touched its handoff within 30 minutes", () => {
        const now = Date.now();
        const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
          files: { "/r/.nereus/handoff/20260912-1400-bbbbbbbb.md": "# Handoff\n\n## 목표\nSEO 스킬 정리" },
          entries: () => [{ name: "20260912-1400-bbbbbbbb.md", mtimeMs: now - 5 * MIN }],
          now: () => now,
        }));
        const ctx = out!.hookSpecificOutput.additionalContext;
        expect(ctx).toContain("다른 세션");
        expect(ctx).toContain("20260912-1400-bbbbbbbb.md");
      });
      it("stays quiet about other sessions inside a loop subsession", () => {
        const now = Date.now();
        const out = handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({
          files: { "/r/.nereus/handoff/20260912-1400-bbbbbbbb.md": "# Handoff\n목표: x" },
          entries: () => [{ name: "20260912-1400-bbbbbbbb.md", mtimeMs: now - 5 * MIN }],
          now: () => now,
          env: { NEREUS_LOOP: "1" },
        }));
        expect(out!.hookSpecificOutput.additionalContext).not.toContain("다른 세션");
      });
      it("prunes stale handoffs without touching the injected or owned file", () => {
        const now = Date.now();
        const removed: string[] = [];
        const entries = Array.from({ length: 12 }, (_, i) => ({ name: `20260901-09${String(i).padStart(2, "0")}-s${i}aaaaaa`.slice(0, 22) + ".md", mtimeMs: now - i * MIN }));
        handle({ session_id: "a1b2c3d4xx", cwd: "/r", source: "startup" }, deps({ entries: () => entries, now: () => now, removeFile: (p: string) => removed.push(p) }));
        expect(removed).toHaveLength(2);
        expect(removed.every((p) => p.includes("/r/.nereus/handoff/"))).toBe(true);
      });
      ```
      `deps()` 헬퍼에 기본값을 더한다: `entries: over.entries ?? (() => []), removeFile: over.removeFile ?? (() => {}), now: over.now ?? (() => Date.now()), env: over.env ?? {}`.
    - [ ] 실패 확인: Run `npx vitest run tests/hooks/session-start.test.ts` · Expected: FAIL (경로 안내 문구 없음)
    - [ ] 최소 구현 — `session-start.mjs` `handle()` 의 handoff 블록을 교체:
      ```js
      const now = (deps.now ?? Date.now)();
      const env = deps.env ?? process.env;
      const dir = handoffDir(cwd);
      const entries = (deps.entries ?? defaultEntries)(dir);
      const mine = sessionHandoffPath({ cwd, sessionId: input.session_id, now, entries });
      const latest = latestHandoff({ cwd, entries, legacyExists: exists(handoffPath(cwd)) });

      let body = "";
      if (latest) { try { body = readFile(latest); } catch { body = ""; } }
      const lead = input.source === "compact" ? COMPACT_LEAD : RESUME_CHECKLIST;
      const head = `이 세션의 handoff 파일: \`${path.relative(cwd, mine)}\` — handoff 는 여기에만 쓴다(다른 세션 파일을 덮어쓰지 않기 위해서다).`;
      const warn = env.NEREUS_LOOP ? [] : recentOtherSessions({ entries, sessionId: input.session_id, now })
        .map((e) => `- \`${e.name}\` — ${firstGoalLine(readFileSafe(path.join(dir, e.name), readFile))}`);
      const block = [body.trim() ? `${lead}\n\n${body.trim()}` : "재개할 handoff 가 없습니다. 새로 시작합니다.", head]
        .concat(warn.length ? [`⚠ 다른 세션이 최근 30분 안에 handoff 를 갱신했습니다. 같은 파일을 건드리는지 확인하세요:\n${warn.join("\n")}`] : []);
      parts.push(`## Baton 재개\n${block.join("\n\n")}`);

      // 정리는 주입 뒤에 조용히. 실패가 세션 시작을 막지 않는다.
      try {
        const protect = [path.basename(mine), latest ? path.basename(latest) : ""].filter(Boolean);
        for (const name of planHandoffPrune({ entries, now, protect })) (deps.removeFile ?? defaultRemoveFile)(path.join(dir, name));
      } catch { /* 무시 */ }
      ```
      같은 파일에 함께 추가한다(기존 compact 안내 문구는 `COMPACT_LEAD` 상수로 뽑는다):
      ```js
      const COMPACT_LEAD = "이전 세션이 남긴 handoff입니다. 여기서 이어서 진행하고, 완료된 항목은 반복하지 마세요.";

      // 디렉터리가 없으면 빈 목록. 훅은 fail-open 이다.
      function defaultEntries(dir) {
        try {
          return fs.readdirSync(dir)
            .filter((name) => name.endsWith(".md"))
            .map((name) => ({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }));
        } catch { return []; }
      }

      function defaultRemoveFile(p) { fs.rmSync(p, { force: true }); }

      function readFileSafe(p, readFile) {
        try { return readFile(p); } catch { return ""; }
      }

      /** 경고 줄에 붙일 한 줄 요약. "## 목표" 다음 첫 내용 줄을 40자로 자른다. */
      function firstGoalLine(text) {
        const lines = String(text).split("\n");
        const at = lines.findIndex((l) => l.trim().startsWith("## 목표"));
        if (at === -1) return "(목표 미상)";
        const body = lines.slice(at + 1).find((l) => l.trim());
        return body ? body.trim().slice(0, 40) : "(목표 미상)";
      }
      ```
    - [ ] 통과 확인: Run `npx vitest run tests/hooks/session-start.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/hooks/scripts/session-start.mjs tests/hooks/session-start.test.ts && git commit -m "feat(baton): 세션별 handoff 주입·동시 세션 경고·정리"`
  - Done when: 기존 session-start 테스트 전부 + 새 6개 통과, 훅이 파일을 만들지 않는다

- [ ] T4. loop-runner 배선 — 프롬프트·환경변수·wave 회수 [wave:1]
  - Files: Modify `plugins/nereus/skills/baton/scripts/loop-runner.mjs` · Test `tests/skills/loop-runner.test.ts` · Test `tests/skills/loop-waves.test.ts`
  - Interfaces: Produces `buildPrompt({ tasks, spec, waves, goal })` (handoff 인자 제거) · `wavesDir(root)` · `runWave` 새 dep `collectHandoff(worktreeDir, destPath)`. Consumes `handoffDir`·`latestHandoff`·`handoffPath` (T1·T2·기존).
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/skills/loop-runner.test.ts` 에 추가:
      ```ts
      it("does not hardcode a handoff file — the session hook owns that path", () => {
        const p = buildPrompt({ tasks: "tasks.md", spec: undefined, waves: ".nereus/waves", goal: "G" });
        expect(p).not.toContain(".nereus/handoff.md");
        expect(p).toContain("세션 시작");
        expect(p).toContain(".nereus/waves");
        expect(p).toContain("(없음)");
      });
      it("marks the child process as a loop subsession", () => {
        expect(claudeEnv({ PATH: "/bin" })).toMatchObject({ PATH: "/bin", NEREUS_LOOP: "1" });
      });
      ```
      `tests/skills/loop-waves.test.ts` 에 추가:
      ```ts
      it("collects each worktree handoff into .nereus/waves before the worktrees are removed", async () => {
        const collected: string[][] = [];
        const removed: string[] = [];
        const r = await runWave(
          [{ text: "A", done: false, wave: 1 }, { text: "B", done: false, wave: 1 }],
          { root: "/repo", goal: "G", paths: { tasks: "tasks.md" } },
          {
            head: () => "abc1234",
            addWorktree: () => ({ ok: true }),
            removeWorktree: (w: any) => { removed.push(w.dir); return { ok: true }; },
            commitIn: () => ({ ok: true }),
            mergeBranch: () => ({ ok: true }),
            runClaude: async () => ({ ok: true }),
            collectHandoff: (from: string, to: string) => { collected.push([from, to]); },
          },
        );
        expect(r.ok).toBe(true);
        expect(collected).toHaveLength(2);
        expect(collected[0][1]).toContain(path.join(".nereus", "waves"));
        // 회수가 워크트리 제거보다 먼저다 — 나중이면 읽을 것이 없다.
        expect(removed).toHaveLength(2);
      });
      it("collects the handoff of a failed task too — the reason is written there", async () => {
        const collected: string[] = [];
        await runWave(
          [{ text: "A", done: false, wave: 1 }, { text: "B", done: false, wave: 1 }],
          { root: "/repo", goal: "G", paths: { tasks: "tasks.md" } },
          {
            head: () => "abc1234",
            addWorktree: () => ({ ok: true }),
            removeWorktree: () => ({ ok: true }),
            commitIn: () => ({ ok: true }),
            mergeBranch: () => ({ ok: true }),
            runClaude: async (_p: string, cwd: string) => ({ ok: !cwd.includes("wave-1") }),
            collectHandoff: (from: string) => { collected.push(from); },
          },
        );
        expect(collected).toHaveLength(2);
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/skills/loop-runner.test.ts tests/skills/loop-waves.test.ts` · Expected: FAIL (`claudeEnv` is not exported, `collectHandoff` 미호출)
    - [ ] 최소 구현 — `loop-runner.mjs`:
      ```js
      export function wavesDir(root) { return path.join(root, ".nereus", "waves"); }

      /** 자식에게 루프 서브세션임을 알린다. SessionStart 훅이 이 값으로 동시 세션 경고를 끈다. */
      export function claudeEnv(base = process.env) { return { ...base, NEREUS_LOOP: "1" }; }
      ```
      `buildPrompt` 를 교체한다:
      ```js
      export function buildPrompt({ tasks, spec, waves, goal }) {
        return [
          `당신은 Nereus Baton 루프의 한 반복입니다. 목표: ${goal}`,
          `이 세션이 쓸 handoff 파일 경로는 **세션 시작 안내**에 적혀 있습니다. 그 파일만 읽고 쓰세요.`,
          `${tasks} 에서 첫 미완료 태스크 하나를 고르세요. 스펙은 ${spec ?? "(없음)"} 입니다.`,
          "그 태스크만 nereus:build 규칙(TDD)으로 끝내고 체크박스를 채우세요. 다른 태스크는 건드리지 마세요.",
          `${waves} 에 파일이 있으면 직전 wave 서브세션들이 남긴 요약입니다. 읽어서 handoff 에 흡수한 뒤 그 파일을 지우세요.`,
          "끝나면 handoff 를 전체 재작성하고(목표/현재 단계/완료/진행 중/다음/실패한 접근과 이유/결정/열린 질문/테스트 상태), 변경을 conventional commit으로 커밋하세요.",
          "막히면 실패한 접근과 이유를 handoff에 남기고 멈추세요. 완료를 검증 없이 선언하지 마세요.",
        ].join("\n");
      }
      ```
      `runWave` 의 `results` 처리 루프 **앞**에 회수를 넣는다(제거는 `finally` 라 그보다 먼저다):
      ```js
      const collectHandoff = deps.collectHandoff ?? defaultCollectHandoff;
      for (const { w } of plans) {
        try { collectHandoff(w.dir, path.join(wavesDir(root), `${w.name}.md`)); } catch { /* 회수 실패가 결과를 바꾸지 않는다 */ }
      }
      ```
      회수 구현은 `paths.mjs` 를 순수하게 두기 위해 디렉터리 읽기를 여기서 한다:
      ```js
      function defaultCollectHandoff(worktreeDir, destPath) {
        const dir = handoffDir(worktreeDir);
        let entries = [];
        try {
          entries = fs.readdirSync(dir)
            .filter((name) => name.endsWith(".md"))
            .map((name) => ({ name, mtimeMs: fs.statSync(path.join(dir, name)).mtimeMs }));
        } catch { entries = []; }
        const src = latestHandoff({ cwd: worktreeDir, entries, legacyExists: fs.existsSync(handoffPath(worktreeDir)) });
        if (!src) return;                       // 남긴 것이 없으면 조용히 건너뛴다
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(src, destPath);
      }
      ```
      `defaultRunClaude` 의 `spawn` 옵션에 `env: claudeEnv()` 를 더한다.
      CLI 진입부의 `paths` 에서 `handoff` 를 빼고 `waves: path.relative(cwd, wavesDir(cwd))` 를 넣는다. `buildPrompt` 호출부(`runWave`)도 새 인자에 맞춘다.
    - [ ] 통과 확인: Run `npx vitest run tests/skills/loop-runner.test.ts tests/skills/loop-waves.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/skills/baton/scripts/loop-runner.mjs tests/skills/loop-runner.test.ts tests/skills/loop-waves.test.ts && git commit -m "feat(loop): wave handoff 회수와 세션 소유 경로 전환"`
  - Done when: loop 테스트 2개 파일 전부 통과, 프롬프트에 고정 handoff 경로가 없다

- [ ] T5. 스킬 문서를 새 경로 규칙으로 맞춘다
  - Files: Modify `plugins/nereus/skills/handoff/SKILL.md` · Modify `plugins/nereus/skills/baton/SKILL.md` · Modify `plugins/nereus/skills/resume/SKILL.md`
  - Interfaces: 없음 (문서). 코드 계약은 T1~T4 가 정한다.
  - Steps:
    - [ ] `handoff/SKILL.md` 1번 항목의 `.nereus/handoff.md` 를 "세션 시작이 알려준 이 세션의 handoff 파일(`.nereus/handoff/` 아래 `시각-sid8.md`)" 로 바꾸고, "다른 세션 파일은 열지도 쓰지도 않는다" 한 줄을 더한다.
    - [ ] `baton/SKILL.md` 의 "진실은 디스크에만 있다" 문단에서 `.nereus/handoff.md` 를 `.nereus/handoff/` 아래 세션별 파일 로 바꾸고, "## 재개" 절에 "읽기는 최신 파일, 쓰기는 자기 세션 파일" 두 줄을 넣는다.
    - [ ] `resume/SKILL.md` 에서 handoff 를 가리키는 경로 표현을 같은 규칙으로 바꾼다.
    - [ ] 확인: Run `grep -rn "nereus/handoff\.md" plugins/nereus/skills plugins/nereus/agents` · Expected: 레거시 폴백을 설명하는 줄 외에는 결과 없음
    - [ ] 커밋: `git add plugins/nereus/skills && git commit -m "docs(baton): 세션별 handoff 경로로 스킬 문서 정렬"`
  - Done when: `grep` 결과에 지시용 경로가 남아 있지 않고, 세 문서가 "쓰기는 자기 세션 파일, 읽기는 최신" 을 같은 말로 적는다

- [ ] T6. 통합 확인과 레거시 폴백 점검
  - Files: Modify `tests/smoke/` 아래 해당 스모크 테스트 파일 (없으면 Create `tests/smoke/handoff-sessions.test.ts`) · Modify `openspec/changes/add-session-handoff/tasks.md`
  - Interfaces: Consumes T1~T4 의 공개 함수 전부. 새 인터페이스 없음.
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/smoke/handoff-sessions.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import fs from "node:fs";
      import os from "node:os";
      import path from "node:path";
      import { handle } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

      describe("two sessions in one project", () => {
        it("never lets one session overwrite the other's handoff", () => {
          const root = fs.mkdtempSync(path.join(os.tmpdir(), "nereus-handoff-"));
          fs.mkdirSync(path.join(root, ".nereus", "handoff"), { recursive: true });
          const a = handle({ session_id: "aaaaaaaa-1", cwd: root, source: "startup" })!.hookSpecificOutput.additionalContext;
          const b = handle({ session_id: "bbbbbbbb-2", cwd: root, source: "startup" })!.hookSpecificOutput.additionalContext;
          const pathOf = (ctx: string) => ctx.match(/\.nereus\/handoff\/[\w-]+\.md/)![0];
          expect(pathOf(a)).not.toBe(pathOf(b));
          fs.rmSync(root, { recursive: true, force: true });
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/smoke/handoff-sessions.test.ts` · Expected: FAIL 또는 PASS. FAIL 이면 T1~T3 의 회귀다 — 고치고 다시 돌린다
    - [ ] 전체 테스트: Run `npm test` · Expected: PASS (기존 테스트 포함 전부)
    - [ ] 레거시 폴백 수동 확인: Run `node -e "import('./plugins/nereus/hooks/scripts/lib/paths.mjs').then(m=>console.log(m.latestHandoff({cwd:'/repo',entries:[],legacyExists:true})))"` · Expected: `/repo/.nereus/handoff.md` 가 출력된다
    - [ ] 커밋: `git add -A && git commit -m "test(baton): 두 세션이 서로의 handoff 를 덮지 않는다"`
  - Done when: `npm test` 전부 통과, 두 세션이 서로 다른 파일을 받는다, 레거시 단일 파일이 여전히 읽힌다

- [ ] T7. lint-tasks 오탐 — 코드 블록 안의 꺾쇠는 플레이스홀더가 아니다
  - Files: Modify `plugins/nereus/skills/spec/scripts/lint-tasks.mjs` · Test `tests/skills/lint-tasks.test.ts`
  - Interfaces: 기존 `lint(text)` 의 반환 형태(`{ pass, tasks, findings }`)를 바꾸지 않는다. 판정만 좁힌다.
  - Steps:
    - [ ] 실패 테스트 작성 — `tests/skills/lint-tasks.test.ts` 에 추가:
      ```ts
      const LT = String.fromCharCode(60), GT = String.fromCharCode(62);
      it("does not flag TypeScript generics inside a fenced code block", () => {
        // 제네릭을 리터럴로 적으면 이 파일 자신이 린터에 걸린다 — 그것이 고치려는 오탐이다.
        const md = [
          "- [ ] T1. 예시",
          "  - Files: Modify `a.ts`",
          "  - Interfaces: 없음",
          "  - Steps:",
          "    - [ ] 구현:",
          "      ```ts",
          `      const rows: Array${LT}string${GT} = [];`,
          `      const pair: Map${LT}string, number${GT} = new Map();`,
          "      ```",
          "  - Done when: 통과",
        ].join("\n");
        expect(lint(md).findings).toEqual([]);
      });
      it("does not flag a less-than comparison inside a fenced code block", () => {
        const md = [
          "- [ ] T1. 예시",
          "  - Files: Modify `a.js`",
          "  - Interfaces: 없음",
          "  - Steps:",
          "    - [ ] 구현:",
          "      ```js",
          "      const cmp = (a, b) => (a.name < b.name ? 1 : -1);",
          "      ```",
          "  - Done when: 통과",
        ].join("\n");
        expect(lint(md).findings).toEqual([]);
      });
      it("still flags an angle-bracket placeholder in prose", () => {
        const md = [
          "- [ ] T1. 예시",
          "  - Files: Modify `a.js`",
          "  - Interfaces: 없음",
          "  - Steps:",
          "    - [ ] 값을 채운다: 채우기 자리표시자 하나",
          "  - Done when: 통과",
        ].join("\n");
        const md2 = md.replace("채우기 자리표시자 하나", String.fromCharCode(60) + "채우기" + String.fromCharCode(62));
        expect(lint(md2).findings.length).toBeGreaterThan(0);
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/skills/lint-tasks.test.ts` · Expected: FAIL (앞의 두 테스트가 findings 를 1건 이상 낸다)
    - [ ] 최소 구현: `lint-tasks.mjs` 에서 플레이스홀더 검사를 돌리기 전에 **펜스 코드 블록을 제거한 사본**을 만들어 그 사본에만 꺾쇠 규칙을 적용한다. 스프레드 오탐 때 말줄임 규칙에 쓴 방식과 같은 자리에 둔다. 코드 블록 밖 규칙과 다른 카테고리 검사는 그대로 둔다.
    - [ ] 통과 확인: Run `npx vitest run tests/skills/lint-tasks.test.ts` · Expected: PASS
    - [ ] 회귀 확인: Run `node plugins/nereus/skills/spec/scripts/lint-tasks.mjs openspec/changes/add-plugin-doctor/tasks.md` · Expected: `"pass": true`
    - [ ] 커밋: `git add plugins/nereus/skills/spec/scripts/lint-tasks.mjs tests/skills/lint-tasks.test.ts && git commit -m "fix(spec): 코드 블록 안의 꺾쇠를 플레이스홀더로 오탐하지 않는다"`
  - Done when: 세 테스트 통과, 기존 두 tasks.md 가 모두 `pass: true`, 산문 속 꺾쇠 자리표시자는 여전히 잡힌다


## Global Constraints

- 런타임은 Node 20+ 표준 라이브러리만 쓴다. 플러그인 코드에 새 의존성을 넣지 않는다.
- 테스트는 vitest (`npm test` = `vitest run`). TDD 강제 — 모든 태스크는 RED 를 실제로 확인한 뒤 구현한다.
- 경로 계산은 `hooks/scripts/lib/paths.mjs` 밖에서 하지 않는다.
- 순수 함수와 I/O 를 분리한다. fs·시각·환경변수는 인자나 deps 로 주입해 훅 통합 없이 테스트한다.
- 훅은 fail-open 이다. 어떤 실패도 세션 시작을 막지 않는다.
- 파일 800줄, 함수 50줄을 넘기지 않는다.
- 기존 `.nereus/handoff.md` 를 읽는 경로는 남긴다. 마이그레이션 스크립트는 만들지 않는다.
