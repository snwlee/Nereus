# Tasks — add-computer-use

- [ ] T1. 통로·안전 판정 순수 함수 judge
  - Files: Create `plugins/nereus/skills/computer-use/scripts/judge.mjs` · Test `tests/skills/computer-use.test.ts`
  - Interfaces: Consumes 없음 · Produces `judge(probe, request): { layer, verdict, reasons }`, `HUMAN_ACTIVE_SECONDS`
  - Steps:
    - [ ] 실패 테스트 작성:
      ```ts
      it("원격 제어 중 입력은 block", () => {
        const r = judge(probeAll(), { risk: "input", targetConfirmed: true, remoteControl: true });
        expect(r.verdict).toBe("block");
        expect(r.reasons).toContain("remote-control-active");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/skills/computer-use.test.ts` · Expected: FAIL (judge.mjs 없음)
    - [ ] 최소 구현: spec 의 computerUse.layer · computerUse.safety 시나리오 7개를 통과하는 judge 작성
    - [ ] 통과 확인: Run `npx vitest run tests/skills/computer-use.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/skills/computer-use/scripts/judge.mjs tests/skills/computer-use.test.ts && git commit -m "feat(computer-use): 통로·안전 판정"`
  - Done when: layer·safety 시나리오 7개가 테스트로 통과한다

- [ ] T2. 실측 파서와 probe CLI
  - Files: Create `plugins/nereus/skills/computer-use/scripts/probe.mjs` · Test `tests/skills/computer-use.test.ts` · Fixtures `tests/fixtures/computer-use/*.json`
  - Interfaces: Consumes `judge(probe, request)` · Produces `parseCuaPermissions(json)`, `parseOrcaCapabilities(json)`, `parseHidIdle(text)`, CLI `node probe.mjs [--risk read|input|irreversible] [--target-confirmed] [--remote] [--approved] [--isolation]`
  - Steps:
    - [ ] 실패 테스트 작성:
      ```ts
      it("Cua 데몬 없음은 unknown", () => {
        const raw = readFileSync("tests/fixtures/computer-use/cua-permissions-no-daemon.json", "utf8");
        expect(parseCuaPermissions(raw)).toEqual({ accessibility: "unknown", screenRecording: "unknown" });
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/skills/computer-use.test.ts` · Expected: FAIL (probe.mjs 없음)
    - [ ] 최소 구현: 세 파서 + 바이너리 호출(없으면 installed false) + judge 결과 JSON 출력
    - [ ] 통과 확인: Run `npx vitest run tests/skills/computer-use.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/skills/computer-use/scripts/probe.mjs tests/skills/computer-use.test.ts tests/fixtures/computer-use && git commit -m "feat(computer-use): 실측 probe"`
  - Done when: 실측 픽스처 파싱 테스트 통과, `node probe.mjs --risk read` 가 이 맥에서 JSON 을 낸다

- [ ] T3. SKILL.md 절차
  - Files: Create `plugins/nereus/skills/computer-use/SKILL.md`
  - Interfaces: Consumes `probe.mjs` CLI · Produces 스킬 절차(판정 → 대상 확인 → pid 입력 → 검증 → 승인)
  - Steps:
    - [ ] 작성: frontmatter(name, description+트리거), 통로 표, 안전 게이트, Cua 명령, Orca 명령, 비전 폴백, 실패 사례
    - [ ] 검증: Run `grep -c "probe.mjs" plugins/nereus/skills/computer-use/SKILL.md` · Expected: 1 이상
    - [ ] 커밋: `git add plugins/nereus/skills/computer-use/SKILL.md && git commit -m "docs(computer-use): 스킬 절차"`
  - Done when: SKILL.md 가 probe 명령과 다섯 실패 사례를 담는다

- [ ] T4. 라우터 트리거
  - Files: Modify `plugins/nereus/hooks/scripts/lib/router.mjs` · Test `tests/lib/router.test.ts`
  - Interfaces: Consumes `routePrompt(text)` · Produces ROUTES 항목 `nereus:computer-use`
  - Steps:
    - [ ] 실패 테스트 작성:
      ```ts
      it("앱 창 조작 요청은 computer-use", () => {
        expect(routePrompt("스튜디오 저장 버튼 눌러줘").map((h) => h.skill)).toContain("nereus:computer-use");
      });
      ```
    - [ ] 실패 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: FAIL
    - [ ] 최소 구현: ROUTES 끝에 computer-use 라우트 추가
    - [ ] 통과 확인: Run `npx vitest run tests/lib/router.test.ts` · Expected: PASS
    - [ ] 커밋: `git add plugins/nereus/hooks/scripts/lib/router.mjs tests/lib/router.test.ts && git commit -m "feat(router): computer-use 트리거"`
  - Done when: 트리거 문장은 라우팅되고, "화면 디자인 바꿔줘" 는 computer-use 로 가지 않는다

- [ ] T5. 버전·스킬 수 표기
  - Files: Modify `plugins/nereus/.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json` · `README.md` · `README.ko.md`
  - Interfaces: 없음
  - Steps:
    - [ ] 수정: nereus 0.21.0 → 0.22.0, README 스킬 수 갱신
    - [ ] 확인: Run `npm test` · Expected: PASS (전체)
    - [ ] 커밋: `git add -A plugins/nereus/.claude-plugin .claude-plugin README.md README.ko.md && git commit -m "chore: nereus 0.22.0 — computer-use"`
  - Done when: `npm test` 전부 통과, 버전 표기 일치

## Global Constraints
- 플러그인 런타임은 Node 표준 라이브러리만(package.json 선언). 외부 npm 금지.
- 판정은 순수 함수, 바이너리 호출은 probe 에만.
- 픽스처는 실측 캡처만 쓴다(하네스가 만든 형식 금지).
- 코어 ROUTES 순서와 MAX_HITS=2 불변.
