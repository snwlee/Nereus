---
name: spec
description: intake 결과를 스펙과 태스크로 만든다. 프로젝트가 신규면 spec-kit(constitution→specify→plan→tasks), 기존이면 OpenSpec(onboard→propose)을 자동 선택한다. "/nereus:spec", "스펙 잡자", "계획 세워", "태스크로 쪼개" 요청 시 사용.
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

1. `openspec/`가 없으면 `openspec init` 후 `/opsx:onboard`로 현재 코드의 역스펙을 만든다. 처음 한 번만.
2. `/opsx:propose <변경 이름>` — intake 목표를 입력. proposal, specs 델타, design, tasks가 생긴다.
3. tasks.md에 아래 "태스크 규칙" 적용.

## 태스크 규칙 (게이트)

- 모든 태스크는 체크박스 `- [ ]`와 **완료 조건** 한 줄을 가진다. 완료 조건은 실행 가능한 검증(테스트 이름, 명령, 관찰 가능한 결과)이어야 한다.
- 핵심 사용자 흐름(로그인, 결제, 데이터 생성·삭제 등)에는 `[flow]` 태그를 붙인다. QA가 E2E 대상을 이걸로 고른다.
- 태스크 하나는 한 세션 안에 끝날 크기(파일 3개 이내, 테스트 포함)로 쪼갠다.
- 규칙을 만족하지 않으면 tasks 파일을 고친 뒤 넘어간다.

## 3. 마무리

`.nereus/handoff.md`를 만들거나 갱신한다(목표, 현재 단계: build, 다음: 첫 태스크). 그 다음 `nereus:build`로 넘어간다.
