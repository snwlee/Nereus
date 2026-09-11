# tasks — add-plugin-doctor

- [x] T1. 플러그인 인벤토리 수집
  - Files: Create `plugins/nereus/hooks/scripts/lib/plugin-inventory.mjs` · Test `tests/lib/plugin-inventory.test.ts`
  - Interfaces: Produces `readInventory({ pluginsFile, settingsFile, readJson, readDir, readText }): PluginRecord[]`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/plugin-inventory.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { readInventory } from "../../plugins/nereus/hooks/scripts/lib/plugin-inventory.mjs";

      const deps = {
        readJson: (p: string) => ({
          "/p/installed.json": { version: 2, plugins: { "ecc@ecc": [{ installPath: "/i/ecc", version: "2.0.0" }] } },
          "/p/settings.json": { enabledPlugins: { "ecc@ecc": false } },
          "/i/ecc/.mcp.json": { mcpServers: { "chrome-devtools": {} } },
          "/i/ecc/hooks/hooks.json": { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [] }] } },
        }[p]),
        readDir: (p: string) => ({ "/i/ecc/skills": ["unified-memory"], "/i/ecc/agents": ["reviewer.md"], "/i/ecc/bin": ["ecc"] }[p] ?? []),
      };

      describe("readInventory", () => {
        it("reads enabled state from settings, not from presence on disk", () => {
          const rows = readInventory({ pluginsFile: "/p/installed.json", settingsFile: "/p/settings.json", ...deps });
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({ name: "ecc@ecc", version: "2.0.0", enabled: false });
        });
        it("collects every conflict surface", () => {
          const s = readInventory({ pluginsFile: "/p/installed.json", settingsFile: "/p/settings.json", ...deps })[0].surfaces;
          expect(s.mcp).toEqual(["chrome-devtools"]);
          expect(s.skills).toEqual(["unified-memory"]);
          expect(s.agents).toEqual(["reviewer"]);
          expect(s.bins).toEqual(["ecc"]);
          expect(s.hooks).toEqual([{ event: "PostToolUse", matcher: "Edit" }]);
        });
        it("returns empty surfaces instead of throwing when a plugin has none", () => {
          const rows = readInventory({
            pluginsFile: "/p/installed.json", settingsFile: "/p/settings.json",
            readJson: (p: string) => (p === "/p/installed.json" ? { plugins: { "bare@x": [{ installPath: "/i/bare", version: "1" }] } } : p === "/p/settings.json" ? { enabledPlugins: { "bare@x": true } } : undefined),
            readDir: () => [],
          });
          expect(rows[0].surfaces).toEqual({ skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null });
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/plugin-inventory.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: `plugin-inventory.mjs` 에 `readInventory` 작성. `installed_plugins.json` 의 각 키에 대해 배열 첫 항목의 `installPath`·`version` 을 쓰고, `enabledPlugins[name] === true` 만 enabled 로 본다. 표면은 `.mcp.json` 의 `mcpServers` 키, `hooks/hooks.json` 의 event 별 matcher, `skills/` 디렉터리명, `agents/` 파일명에서 확장자 제거, `bin/` 파일명, 루트 `settings.json` 의 `agent` 키에서 모은다. 읽기 실패는 전부 빈 값으로 삼킨다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/plugin-inventory.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/plugin-inventory.mjs tests/lib/plugin-inventory.test.ts && git commit -m "feat(doctor): 플러그인 충돌 표면 인벤토리"`
  - Done when: 세 테스트 통과, 파일 읽기 실패가 예외로 새어나오지 않는다

- [x] T2. 구조적 충돌 판정과 지문 [wave:1]
  - Files: Create `plugins/nereus/hooks/scripts/lib/plugin-conflicts.mjs` · Test `tests/lib/plugin-conflicts.test.ts`
  - Interfaces: Consumes `PluginRecord[]` (T1 의 `readInventory` 반환 모양) · Produces `structuralConflicts(records, scope): Conflict[]`, `fingerprint(conflict): string`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/plugin-conflicts.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { structuralConflicts, fingerprint } from "../../plugins/nereus/hooks/scripts/lib/plugin-conflicts.mjs";

      const rec = (name: string, version: string, enabled: boolean, surfaces: any) => ({
        name, version, enabled, installPath: "/i/" + name,
        surfaces: { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null, ...surfaces },
      });

      describe("structuralConflicts", () => {
        it("flags a duplicated MCP server name as HIGH with a deny remedy", () => {
          const c = structuralConflicts([
            rec("ecc@ecc", "2.0.0", true, { mcp: ["chrome-devtools"] }),
            rec("nereus@nereus", "0.19.3", true, { mcp: ["chrome-devtools"] }),
          ], "global");
          expect(c).toHaveLength(1);
          expect(c[0]).toMatchObject({ severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global" });
          expect(c[0].remedy).toMatchObject({ applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" });
        });
        it("ignores a duplicate when one side is disabled", () => {
          expect(structuralConflicts([
            rec("ecc@ecc", "2.0.0", false, { mcp: ["chrome-devtools"] }),
            rec("nereus@nereus", "0.19.3", true, { mcp: ["chrome-devtools"] }),
          ], "global")).toEqual([]);
        });
        it("flags duplicated agent names and bin names as HIGH", () => {
          const kinds = structuralConflicts([
            rec("a@m", "1", true, { agents: ["reviewer"], bins: ["ooo"] }),
            rec("b@m", "1", true, { agents: ["reviewer"], bins: ["ooo"] }),
          ], "global").map((x: any) => x.kind).sort();
          expect(kinds).toEqual(["agent-shadow", "bin-shadow"]);
        });
        it("flags a shared hook point as LOW with no remedy", () => {
          const c = structuralConflicts([
            rec("a@m", "1", true, { hooks: [{ event: "PostToolUse", matcher: "Edit" }] }),
            rec("b@m", "1", true, { hooks: [{ event: "PostToolUse", matcher: "Edit" }] }),
          ], "global");
          expect(c[0]).toMatchObject({ severity: "LOW", kind: "hook-shared" });
          expect(c[0].remedy.applicable).toBe(false);
        });
      });

      describe("fingerprint", () => {
        const base = { kind: "mcp-shadow", unit: "chrome-devtools", sides: [{ name: "ecc@ecc", version: "2.0.0" }, { name: "nereus@nereus", version: "0.19.3" }] };
        it("is stable regardless of side order", () => {
          expect(fingerprint(base)).toBe(fingerprint({ ...base, sides: [base.sides[1], base.sides[0]] }));
        });
        it("changes when a version changes", () => {
          expect(fingerprint(base)).not.toBe(fingerprint({ ...base, sides: [{ name: "ecc@ecc", version: "2.1.0" }, base.sides[1]] }));
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/plugin-conflicts.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: 활성 레코드만 대상으로 mcp·agents·bins 각각을 유닛 이름으로 그룹핑해 2개 이상이면 각각 `mcp-shadow`·`agent-shadow`·`bin-shadow` 를 HIGH 로 낸다. hooks 는 `event + "|" + matcher` 로 그룹핑해 `hook-shared` 를 LOW 로 내고 `remedy.applicable` 은 false 로 둔다. HIGH 의 remedy 는 mcp 만 `permissions-deny` 로 `"mcp__" + unit`, agent 는 `permissions-deny` 로 `"Agent(" + unit + ")"`, bin 은 `applicable: false` 로 둔다. `fingerprint` 는 `node:crypto` 의 sha256 으로 `kind`, 이름@버전 두 개를 정렬해 이은 것, `unit` 을 이어 해시하고 앞 16자를 반환한다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/plugin-conflicts.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/plugin-conflicts.mjs tests/lib/plugin-conflicts.test.ts && git commit -m "feat(doctor): 구조적 섀도잉 판정과 지문"`
  - Done when: 여섯 테스트 통과, 비활성 플러그인이 판정에 섞이지 않는다

- [x] T3. 큐레이션 표와 MEDIUM 판정 [wave:1]
  - Files: Create `plugins/nereus/hooks/scripts/lib/plugin-curated.mjs` · Test `tests/lib/plugin-curated.test.ts`
  - Interfaces: Consumes `PluginRecord[]` (T1 의 `readInventory` 반환 모양) · Produces `CURATED: CuratedEntry[]`, `curatedConflicts(records, scope): Conflict[]`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/plugin-curated.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { CURATED, curatedConflicts } from "../../plugins/nereus/hooks/scripts/lib/plugin-curated.mjs";

      const rec = (name: string, version: string, enabled = true) => ({ name, version, enabled, installPath: "/i", surfaces: { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null } });

      describe("curatedConflicts", () => {
        it("reports the superpowers double gate as MEDIUM with a manual remedy", () => {
          const c = curatedConflicts([rec("superpowers@obra", "1.2.0"), rec("nereus@nereus", "0.19.3")], "global");
          const gate = c.find((x: any) => x.unit === "verification-before-completion");
          expect(gate).toMatchObject({ severity: "MEDIUM", kind: "double-gate" });
          expect(gate.remedy.applicable).toBe(false);
          expect(gate.remedy.manual).toContain("/plugin");
          expect(gate.evidence.length).toBeGreaterThan(0);
        });
        it("stays silent when only one side is present", () => {
          expect(curatedConflicts([rec("nereus@nereus", "0.19.3")], "global")).toEqual([]);
        });
        it("stays silent when a side is disabled", () => {
          expect(curatedConflicts([rec("superpowers@obra", "1.2.0", false), rec("nereus@nereus", "0.19.3")], "global")).toEqual([]);
        });
        it("ships only entries whose evidence and remedy are written", () => {
          expect(CURATED.length).toBe(2);
          for (const e of CURATED) {
            expect(e.evidence.trim().length).toBeGreaterThan(10);
            expect(e.remedy).toBeTruthy();
          }
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/plugin-curated.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: `CURATED` 에 두 항목만 넣는다. (1) superpowers 와 nereus 가 함께 활성이면 `verification-before-completion` 이 `nereus:finish` 와 이중 게이트라는 항목, remedy 는 `applicable:false` 에 `/plugin` 화면에서 해당 스킬을 끄라는 수동 문자열. (2) ecc 와 nereus 가 함께 활성이면 `unified-memory` 가 claude-mem 과 겹친다는 항목. 각 항목은 `evidence` 에 근거 한 문장을 갖는다. `curatedConflicts` 는 양쪽 플러그인이 모두 활성일 때만 Conflict 를 만들고 severity 는 MEDIUM 으로 고정한다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/plugin-curated.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/plugin-curated.mjs tests/lib/plugin-curated.test.ts && git commit -m "feat(doctor): 큐레이션 이중 게이트 표"`
  - Done when: 네 테스트 통과, 표 항목이 정확히 2개이고 각각 근거 문장을 갖는다

- [x] T4. 원장·수용 지문·undo 계획
  - Files: Create `plugins/nereus/hooks/scripts/lib/doctor-ledger.mjs` · Test `tests/lib/doctor-ledger.test.ts`
  - Interfaces: Consumes `Conflict` (T2 의 `structuralConflicts` 반환 모양) · Produces `isAcked(entries, fp): boolean`, `planUndo({ entry, currentFile }): UndoPlan`
  - Steps:
    - [x] 실패 테스트 작성 `tests/lib/doctor-ledger.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { isAcked, planUndo } from "../../plugins/nereus/hooks/scripts/lib/doctor-ledger.mjs";

      const entry = { type: "apply", path: ["permissions", "deny"], before: undefined, after: ["mcp__chrome-devtools"], fileHash: "abc123" };

      describe("isAcked", () => {
        it("silences a matching fingerprint and only that one", () => {
          const led = [{ type: "ack", fingerprint: "ff00" }];
          expect(isAcked(led, "ff00")).toBe(true);
          expect(isAcked(led, "ff01")).toBe(false);
        });
        it("treats an unack line as cancelling an earlier ack", () => {
          expect(isAcked([{ type: "ack", fingerprint: "ff00" }, { type: "unack", fingerprint: "ff00" }], "ff00")).toBe(false);
        });
      });

      describe("planUndo", () => {
        it("reverts when the file hash still matches", () => {
          expect(planUndo({ entry, currentFile: { hash: "abc123", valueAt: () => ["mcp__chrome-devtools"] } }))
            .toMatchObject({ action: "revert", reason: "hash-match" });
        });
        it("reverts only the recorded path when the file changed elsewhere", () => {
          expect(planUndo({ entry, currentFile: { hash: "zzz", valueAt: () => ["mcp__chrome-devtools"] } }))
            .toMatchObject({ action: "revert", reason: "path-intact" });
        });
        it("stops and reports when the recorded path itself changed", () => {
          const p = planUndo({ entry, currentFile: { hash: "zzz", valueAt: () => ["mcp__other"] } });
          expect(p.action).toBe("stop");
          expect(p.expected).toEqual(["mcp__chrome-devtools"]);
          expect(p.actual).toEqual(["mcp__other"]);
        });
        it("succeeds idempotently when the path is already gone", () => {
          expect(planUndo({ entry, currentFile: { hash: "zzz", valueAt: () => undefined } }))
            .toMatchObject({ action: "noop", reason: "path-absent" });
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/lib/doctor-ledger.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: `isAcked` 는 원장 줄을 순서대로 훑어 같은 지문의 마지막 `ack` 또는 `unack` 을 채택한다. `planUndo` 는 네 분기를 순서대로 판정한다. 경로 값이 `undefined` 면 `noop`, 해시가 같으면 `revert` 에 `hash-match`, 값이 기록된 `after` 와 깊은 비교로 같으면 `revert` 에 `path-intact`, 그 외에는 `stop` 에 `expected` 와 `actual` 을 담는다. 판정 순서상 부재 검사가 해시 검사보다 앞선다.
    - [x] 통과 확인: Run `npx vitest run tests/lib/doctor-ledger.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/hooks/scripts/lib/doctor-ledger.mjs tests/lib/doctor-ledger.test.ts && git commit -m "feat(doctor): 원장 수용 지문과 undo 4분기 계획"`
  - Done when: 여섯 테스트 통과, undo 가 드리프트에서 덮어쓰지 않고 멈춘다

- [x] T4b. 처방 적용·원장 append·스코프별 저장
  - Files: Create `plugins/nereus/skills/doctor/scripts/apply.mjs` · Test `tests/skills/doctor-apply.test.ts`
  - Interfaces: Consumes `Conflict` (T2 형태), `planUndo` (T4) · Produces `applyRemedy({ conflict, settings, now }): { settings, entry }`, `ledgerPathFor(scope, { home, cwd }): string`
  - Steps:
    - [x] 실패 테스트 작성 `tests/skills/doctor-apply.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { applyRemedy, ledgerPathFor } from "../../plugins/nereus/skills/doctor/scripts/apply.mjs";

      const high = { severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global", fingerprint: "aa", sides: [], remedy: { applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" } };
      const manual = { severity: "MEDIUM", kind: "double-gate", unit: "verification-before-completion", scope: "global", fingerprint: "bb", sides: [], remedy: { applicable: false, manual: "/plugin 에서 끄세요" } };

      describe("applyRemedy", () => {
        it("adds the deny rule and records path, before, after and hash", () => {
          const r = applyRemedy({ conflict: high, settings: { permissions: { deny: ["Bash(rm)"] } }, now: 1 });
          expect(r.settings.permissions.deny).toEqual(["Bash(rm)", "mcp__chrome-devtools"]);
          expect(r.entry).toMatchObject({ type: "apply", path: ["permissions", "deny"], before: ["Bash(rm)"], after: ["Bash(rm)", "mcp__chrome-devtools"], fingerprint: "aa" });
          expect(typeof r.entry.fileHash).toBe("string");
        });
        it("records absence when the key did not exist", () => {
          const r = applyRemedy({ conflict: high, settings: {}, now: 1 });
          expect(r.entry.before).toBeUndefined();
          expect(r.settings.permissions.deny).toEqual(["mcp__chrome-devtools"]);
        });
        it("does not mutate the settings object it was given", () => {
          const original = { permissions: { deny: ["Bash(rm)"] } };
          applyRemedy({ conflict: high, settings: original, now: 1 });
          expect(original.permissions.deny).toEqual(["Bash(rm)"]);
        });
        it("refuses a remedy that is not applicable", () => {
          expect(() => applyRemedy({ conflict: manual, settings: {}, now: 1 })).toThrow(/수동/);
        });
        it("is idempotent when the deny rule is already present", () => {
          const r = applyRemedy({ conflict: high, settings: { permissions: { deny: ["mcp__chrome-devtools"] } }, now: 1 });
          expect(r.settings.permissions.deny).toEqual(["mcp__chrome-devtools"]);
          expect(r.entry).toBeNull();
        });
      });

      describe("ledgerPathFor", () => {
        it("keeps global findings in the user config dir", () => {
          expect(ledgerPathFor("global", { home: "/h", cwd: "/w" })).toBe("/h/.config/nereus/doctor-ledger.jsonl");
        });
        it("keeps project findings in the project so other projects stay noisy", () => {
          expect(ledgerPathFor("project", { home: "/h", cwd: "/w" })).toBe("/w/.nereus/doctor-ack.jsonl");
        });
      });
      ```
    - [x] 실패 확인: Run `npx vitest run tests/skills/doctor-apply.test.ts` · Expected: FAIL (모듈 없음)
    - [x] 최소 구현: `applyRemedy` 는 입력 settings 를 구조적 복사해 새 객체를 만든다(불변성). `remedy.applicable` 이 false 면 수동 처방임을 담은 오류를 던진다. 이미 같은 값이 `permissions.deny` 에 있으면 settings 를 그대로 두고 `entry` 를 null 로 반환한다. `fileHash` 는 `node:crypto` sha256 으로 적용 후 settings 의 JSON 직렬화를 해싱한다. `ledgerPathFor` 는 global 이면 홈 아래 `.config/nereus/doctor-ledger.jsonl`, project 면 cwd 아래 `.nereus/doctor-ack.jsonl` 을 반환한다.
    - [x] 통과 확인: Run `npx vitest run tests/skills/doctor-apply.test.ts` · Expected: PASS
    - [x] 커밋: `git add plugins/nereus/skills/doctor/scripts/apply.mjs tests/skills/doctor-apply.test.ts && git commit -m "feat(doctor): 처방 적용과 스코프별 원장 경로"`
  - Done when: 일곱 테스트 통과, 입력 settings 가 변형되지 않고 프로젝트 수용이 전역에 새지 않는다

- [ ] T5. doctor CLI 와 리포트 렌더
  - Files: Create `plugins/nereus/skills/doctor/scripts/doctor.mjs` · Test `tests/skills/doctor-cli.test.ts`
  - Interfaces: Consumes `structuralConflicts`, `curatedConflicts`, `isAcked` · Produces `renderReport(conflicts, opts): string`, `runDoctor(argv, deps): object`
  - Steps:
    - [ ] 실패 테스트 작성 `tests/skills/doctor-cli.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { renderReport, runDoctor } from "../../plugins/nereus/skills/doctor/scripts/doctor.mjs";

      const conflicts = [
        { severity: "HIGH", kind: "mcp-shadow", unit: "chrome-devtools", scope: "global", fingerprint: "aa", sides: [], remedy: { applicable: true, kind: "permissions-deny", value: "mcp__chrome-devtools" } },
        { severity: "MEDIUM", kind: "double-gate", unit: "verification-before-completion", scope: "global", fingerprint: "bb", sides: [], evidence: "완료 게이트가 두 번 돈다", remedy: { applicable: false, manual: "/plugin 에서 끄세요" } },
        { severity: "LOW", kind: "hook-shared", unit: "PostToolUse|Edit", scope: "global", fingerprint: "cc", sides: [], remedy: { applicable: false } },
      ];

      describe("renderReport", () => {
        it("hides LOW by default and summarises its count", () => {
          const out = renderReport(conflicts, { all: false });
          expect(out).toContain("chrome-devtools");
          expect(out).toContain("verification-before-completion");
          expect(out).not.toContain("PostToolUse|Edit");
          expect(out).toMatch(/LOW 1건/);
        });
        it("shows LOW with --all", () => {
          expect(renderReport(conflicts, { all: true })).toContain("PostToolUse|Edit");
        });
        it("marks an inapplicable remedy as manual rather than pretending", () => {
          const out = renderReport(conflicts, { all: false });
          expect(out).toContain("수동");
          expect(out).toContain("/plugin");
        });
      });

      describe("runDoctor", () => {
        it("never executes plugin uninstall, only prints it", () => {
          const ran: string[] = [];
          const r = runDoctor(["--remove", "ecc@ecc"], { conflicts, run: (c: string) => { ran.push(c); return { ok: true }; }, write: () => {} });
          expect(ran).toEqual([]);
          expect(r.output).toContain("/plugin uninstall ecc@ecc");
        });
        it("writes nothing without an explicit apply", () => {
          const writes: string[] = [];
          runDoctor([], { conflicts, run: () => ({ ok: true }), write: (p: string) => { writes.push(p); } });
          expect(writes).toEqual([]);
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/skills/doctor-cli.test.ts` · Expected: FAIL (모듈 없음)
    - [ ] 최소 구현: `renderReport` 는 HIGH, MEDIUM 을 표로 내고 LOW 는 `--all` 없이는 `LOW 1건` 형태의 요약 한 줄로만 낸다. `remedy.applicable` 이 false 면 처방 칸에 `수동` 과 `remedy.manual` 문자열을 넣는다. `runDoctor` 는 인자가 없으면 리포트만 내고 어떤 쓰기도 하지 않는다. `--remove` 는 `/plugin uninstall` 문자열을 출력에 넣기만 하고 `run` 을 호출하지 않는다.
    - [ ] 통과 확인: Run `npx vitest run tests/skills/doctor-cli.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/skills/doctor/scripts/doctor.mjs tests/skills/doctor-cli.test.ts && git commit -m "feat(doctor): CLI 리포트와 파괴 금지 게이트"`
  - Done when: 다섯 테스트 통과, 인자 없는 실행이 파일을 쓰지 않고 제거 명령을 실행하지 않는다

- [ ] T6. SessionStart 스냅샷 알림 배선
  - Files: Modify `plugins/nereus/hooks/scripts/session-start.mjs` · Test `tests/hooks/session-start-plugins.test.ts`
  - Interfaces: Consumes `readInventory` (T1) · Produces `pluginSnapshotNote({ records, previous }): { note, snapshot }`
  - Steps:
    - [ ] 실패 테스트 작성 `tests/hooks/session-start-plugins.test.ts`:
      ```ts
      import { describe, it, expect } from "vitest";
      import { pluginSnapshotNote, handle } from "../../plugins/nereus/hooks/scripts/session-start.mjs";

      const rec = (name: string, enabled = true) => ({ name, version: "1", enabled, installPath: "/i", surfaces: { skills: [], hooks: [], mcp: [], agents: [], bins: [], mainAgent: null } });

      describe("pluginSnapshotNote", () => {
        it("records a baseline without announcing on first run", () => {
          const r = pluginSnapshotNote({ records: [rec("a@m"), rec("b@m")], previous: null });
          expect(r.note).toBeNull();
          expect(r.snapshot.sort()).toEqual(["a@m", "b@m"]);
        });
        it("announces only names absent from the previous snapshot", () => {
          const r = pluginSnapshotNote({ records: [rec("a@m"), rec("b@m")], previous: ["a@m"] });
          expect(r.note).toContain("새 플러그인 1개");
          expect(r.note).toContain("/nereus:doctor");
        });
        it("says nothing when the set is unchanged", () => {
          expect(pluginSnapshotNote({ records: [rec("a@m")], previous: ["a@m"] }).note).toBeNull();
        });
        it("ignores disabled plugins", () => {
          expect(pluginSnapshotNote({ records: [rec("a@m"), rec("z@m", false)], previous: ["a@m"] }).note).toBeNull();
        });
      });

      describe("handle — compact", () => {
        it("neither announces nor updates the snapshot on compact", () => {
          let wrote = false;
          const out = handle({ cwd: "/w", source: "compact" }, {
            exists: () => false, readFile: () => "", learnings: () => "",
            toolStatus: () => ({ missing: [] }), pendingCandidates: () => 0,
            pluginRecords: () => [rec("new@m")], readSnapshot: () => [], writeSnapshot: () => { wrote = true; },
          });
          expect(wrote).toBe(false);
          expect(out).toBeNull();
        });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/hooks/session-start-plugins.test.ts` · Expected: FAIL (`pluginSnapshotNote` 없음)
    - [ ] 최소 구현: `session-start.mjs` 에 `pluginSnapshotNote` 를 export 하고, `handle` 의 상태 블록 부분에서 `source` 가 `compact` 가 아닐 때만 `pluginRecords`·`readSnapshot` 을 호출해 note 를 notes 배열에 넣고 `writeSnapshot` 으로 갱신한다. 기본 주입은 `readInventory` 와 `~/.config/nereus/plugin-snapshot.json` 이고, 전부 deps 로 주입 가능해야 한다. 읽기·쓰기 실패는 삼킨다.
    - [ ] 통과 확인: Run `npx vitest run tests/hooks/session-start-plugins.test.ts && npx vitest run tests/hooks/` · Expected: PASS (기존 훅 테스트 포함)
    - [ ] 커밋: `git add plugins/nereus/hooks/scripts/session-start.mjs tests/hooks/session-start-plugins.test.ts && git commit -m "feat(doctor): SessionStart 새 플러그인 한 줄 알림"`
  - Done when: 다섯 테스트 통과, compact 에서 스냅샷을 쓰지 않고 첫 실행이 조용하다

- [ ] T7. SKILL.md·setup 연동·reverse-spec 포맷 결함 수정
  - Files: Create `plugins/nereus/skills/doctor/SKILL.md` · Modify `plugins/nereus/skills/setup/SKILL.md` · Modify `plugins/nereus/skills/spec/references/reverse-spec.md`
  - Interfaces: Consumes `doctor.mjs` CLI · Produces 없음
  - Steps:
    - [ ] `plugins/nereus/skills/doctor/SKILL.md` 작성. frontmatter 의 `name` 은 `doctor`, `description` 은 다른 하네스 플러그인과의 충돌을 점검한다는 내용과 "충돌", "중복", "플러그인 정리" 트리거를 담는다. 본문에 심각도 3단계 의미, 처방 3단계, 스킬 충돌은 파일로 못 고치고 수동 절차만 가능하다는 제약, `--all`·`--undo`·`--unack` 사용법을 적는다.
    - [ ] `plugins/nereus/skills/setup/SKILL.md` 의 "## 1. 감지" 절 끝에 doctor 실행 한 줄을 추가한다:
      ```bash
      node "${CLAUDE_PLUGIN_ROOT}/skills/doctor/scripts/doctor.mjs"
      ```
    - [ ] `plugins/nereus/skills/spec/references/reverse-spec.md` 를 OpenSpec CLI 1.12 와 맞춘다. 실제로 이 사이클에서 세 번 걸렸다. 세 곳을 고친다: (1) 스펙 파일은 `## Purpose` 와 `## Requirements` 섹션을 가져야 한다고 명시 (2) `### Invariant:` 는 CLI 가 Requirement 로 파싱해 Scenario 를 요구하므로, `### Requirement:` 로 쓰고 불변임을 주석으로 표시하라고 바꾼다 (3) 변경 델타 파일은 `## ADDED Requirements` 같은 델타 헤더를 써야 한다고 추가한다.
    - [ ] 검증: Run `openspec validate --specs && openspec validate --changes` · Expected: PASS (2 specs, 1 change)
    - [ ] 검증: Run `npx vitest run` · Expected: PASS (전체 통과)
    - [ ] 커밋: `git add plugins/nereus/skills/doctor/SKILL.md plugins/nereus/skills/setup/SKILL.md plugins/nereus/skills/spec/references/reverse-spec.md && git commit -m "docs(doctor): SKILL 작성, setup 연동, reverse-spec OpenSpec 호환"`
  - Done when: `openspec validate` 가 전부 통과하고, reverse-spec.md 대로 새로 쓴 스펙이 CLI 를 통과한다

## Global Constraints

- 플러그인 런타임 코드는 **Node 표준 라이브러리만** 쓴다. 외부 의존성 추가 금지.
- 테스트 러너는 vitest. 테스트는 `tests/` 아래, 실제 홈 디렉터리를 읽지 않고 전부 주입으로 격리한다.
- doctor 는 `/plugin uninstall` 을 실행하지 않는다. 문자열 출력만 한다.
- 전역 설정 쓰기는 원자적 쓰기(임시 파일 + rename)로 하고 원장은 append-only 로 남긴다.
- 이번 사이클에서 실제 `~/.claude/settings.json` 에 쓰지 않는다. 쓰기 경로는 임시 디렉터리 픽스처로만 검증한다.
- 파일 하나가 400줄을 넘으면 쪼갠다.
