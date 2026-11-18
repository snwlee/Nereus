## Implementation

- [x] T1. Publish one owner and binding per work unit
  - Files: Create `plugins/nereus/hooks/scripts/lib/session-documents.mjs` · Test `tests/lib/session-documents.test.ts`
  - Interfaces: Produces `claimWork(cwd, sessionId, file)`, `claimedTasks(cwd, sessionId)`, `releaseWork(cwd, sessionId)`
  - Steps:
    - [x] Reproduce competing claims with the independent CLI process regression in `tests/lib/session-documents.test.ts`.
    - [x] Publish the registry through an atomic rename while holding the checkout lock.
    - [x] Run: `npm test -- tests/lib/session-documents.test.ts` · Expected: PASS
  - Done when: two sessions claiming the same task file yield one owner and a conflict.

- [x] T2. Scope workflow notes and task selection to the session
  - Files: Modify `plugins/nereus/hooks/scripts/lib/tasks.mjs` · Modify `plugins/nereus/hooks/scripts/finish-check.mjs` · Modify `plugins/nereus/skills/hud/scripts/hud.mjs`
  - Interfaces: Consumes `claimedTasks(cwd, sessionId)` · Produces `sessionTaskProgress(cwd, sessionId)`
  - Steps:
    - [x] Read the registered file and return no progress if it is missing.
    - [x] Pass the current session ID into HUD and Stop and pin auto-continue to the original task file.
    - [x] Run: `npm test -- tests/lib/session-documents.test.ts tests/lib/tasks.test.ts` · Expected: PASS
  - Done when: each active session shows its own progress and cannot consume the other session's continuation.

- [x] T3. Connect claim lifecycle and guarded archive to the workflow
  - Files: Create `plugins/nereus/skills/spec/scripts/session-work.mjs` · Modify `plugins/nereus/hooks/scripts/pre-tool-guard.mjs` · Modify `plugins/nereus/skills/finish/SKILL.md`
  - Interfaces: Consumes `withWorkLock(cwd, action)` and `sessionTaskProgress(cwd, sessionId)` · Produces the session-work CLI
  - Steps:
    - [x] Connect the structured edit guard and route archive through the registered change.
    - [x] Document registration before spec/build, owner handoff, and release after finish.
    - [x] Run: `npm test -- tests/lib/session-documents.test.ts tests/skills/model-tier-docs.test.ts` · Expected: PASS
  - Done when: archive rejects incomplete or unowned work, and a competing archive cannot update shared specs simultaneously.

## Global Constraints

Use the Node standard library. Keep local ownership records outside Git and preserve the standalone read-only task lookup.
