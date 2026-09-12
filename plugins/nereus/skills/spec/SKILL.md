---
name: spec
description: Turn intake output into a spec and tasks — spec-kit for greenfield, OpenSpec for existing code, chosen automatically. 트리거: "스펙", "계획", "태스크로 쪼개".
---

# spec

nereus:common 규칙을 따른다. 담당 에이전트: architect.

## 1. 판별

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/spec/scripts/classify.mjs" "$PWD"
```
결과 `kind`와 `reason`을 사용자에게 한 줄로 알리고 다른 판단을 원하는지 묻지 않는다. 사용자가 명시적으로 `--tool spec-kit|openspec`을 주면 그걸 따른다.

## 2A. 신규 → spec-kit

1. `.specify/`가 없으면 `specify init --here --ai claude` 실행 (없으면 setup 안내).
2. `/speckit.constitution` — `.nereus/intake.md`의 제약과 nereus:common 규칙(TDD, 불변성, 작은 파일)을 원칙으로 넣는다.
3. `/speckit.specify` — intake의 목표·가정을 입력. 기술 스택 언급 금지(what/why만).
4. `/speckit.clarify` — 미정 항목이 남았으면.
5. `/speckit.plan` — 스택(Flutter/Spring/TS 중 해당), 테스트 러너, E2E 도구 명시.
6. `/speckit.tasks` — 태스크 생성 후 아래 "태스크 규칙" 적용.

## 2B. 기존 → OpenSpec

1. `plan.reverseSpec` 이 true 이고 아직 기준선이 없으면 역스펙을 만든다(`openspec/`가 없으면 `openspec init` 먼저). `/opsx:onboard`가 있으면 써도 되고, 없으면 `references/reverse-spec.md` 절차대로 직접 캔다(읽기 전용, capability 단위로 작게).
2. `/opsx:propose <변경 이름>` — intake 목표를 입력. proposal, specs 델타, design, tasks가 생긴다.
3. tasks.md에 아래 "태스크 규칙" 적용.

## 디자인 방향 (UI 가 있으면 게이트)

화면·컴포넌트가 생기는 스펙이면 태스크를 쪼개기 전에 방향을 Gemini 에게 비평받고 그 결과를 스펙에 적는다.
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/design-feedback.mjs" direction --brief <방향 브리프 파일>
```
브리프에는 스타일 방향(에디토리얼·라이트 럭셔리·벤토 등 구체적으로), 팔레트, 타이포 페어링, 레퍼런스를 적는다.
verdict 가 REVISE 면 방향을 고쳐 다시 돌린다. 이 라운드가 없으면 신규 디자인 파일이 finish 게이트에서 차단된다.

## 태스크 규칙 (게이트)

- 모든 태스크는 체크박스 `- [ ]`와 **완료 조건** 한 줄을 가진다. 완료 조건은 실행 가능한 검증(테스트 이름, 명령, 관찰 가능한 결과)이어야 한다.
- 핵심 사용자 흐름(로그인, 결제, 데이터 생성·삭제 등)에는 `[flow]` 태그를 붙인다. QA가 E2E 대상을 이걸로 고른다.
- 병렬로 돌려도 되는 태스크에는 `[wave:N]` 을 붙인다(같은 N 이 인접해 있어야 묶인다). 조건: **같은 wave 의 태스크가 같은 파일을 만지지 않는다** — 겹치면 병합 충돌로 루프가 멈춘다. 확신이 없으면 붙이지 않는다(태그 없음 = 순차, 안전한 기본값). 자세한 규칙은 nereus:loop.
- 태스크 하나는 한 세션 안에 끝날 크기(파일 3개 이내, 테스트 포함)로 쪼갠다.
- 태스크마다 아래 형식을 채운다. 비어 있는 항목은 "없음"이라고 쓴다.

```markdown
- [ ] T3. 토큰 만료 검사 미들웨어 [flow]
  - Files: Create `src/auth/expiry.ts` · Modify `src/app.ts:40-55` · Test `src/auth/expiry.test.ts`
  - Interfaces: Consumes `verifyToken(token): Claims` · Produces `expiryGuard(): Middleware`
  - Steps:
    - [ ] 실패 테스트 작성:
      ```ts
      it("만료 토큰은 401", async () => {
        await request(app).get("/me").set("Authorization", expired).expect(401);
      });
      ```
    - [ ] 실패 확인: Run `npm test -- expiry` · Expected: FAIL (expiryGuard 없음)
    - [ ] 최소 구현: `src/auth/expiry.ts`에 위 테스트만 통과하는 가드 작성
    - [ ] 통과 확인: Run `npm test -- expiry` · Expected: PASS
    - [ ] 커밋: `git add src/auth/expiry.ts src/auth/expiry.test.ts && git commit -m "feat(auth): token expiry guard"`
  - Done when: 만료 토큰 요청이 401, 유효 토큰은 통과, `npm test` 전부 통과
```
- Steps는 실행자가 그대로 옮기면 되는 축어 내용이다. 코드 단계엔 코드 블록, 실행 단계엔 `Run:` 명령과 `Expected:` FAIL/PASS를 반드시 적는다 (출처: superpowers `writing-plans`).
- 플레이스홀더 금지 (위반은 계획 실패다): `TBD`·`...`·`<채우기>`·`TODO`는 물론, "적절한 에러 처리를 추가" 같은 뭉뚱그림, 코드 없는 "위 항목 테스트 작성", "Task N과 유사하게" (코드를 반복해 적는다 — 실행자는 태스크를 순서 없이 읽는다), 어떤 태스크에도 정의되지 않은 타입·함수 참조.
- 태스크 파일 끝에 **Global Constraints**(전 태스크 공통 제약: 스택, 금지 라이브러리, 성능 예산)를 한 번 적는다.
- tasks 파일을 저장하기 전에 검사기를 돌린다. 위반이 있으면 고친 뒤 넘어간다.
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/spec/scripts/lint-tasks.mjs" <tasks파일>
```
- 저장 후 **Self-Review** (스스로, 서브에이전트 없이): (1) spec coverage — 스펙의 각 요구를 가리키는 태스크가 있는가, 없으면 태스크 추가. (2) placeholder scan — 위 금지 패턴을 파일에서 검색해 수정. (3) type consistency — 뒤 태스크의 타입·시그니처·이름이 앞 태스크 정의와 일치하는가.

## 3. 마무리

이 세션의 handoff 파일(`.nereus/handoff/` 아래)을 만들거나 갱신한다(목표, 현재 단계: build, 다음: 첫 태스크). 그 다음 `nereus:build`로 넘어간다.
