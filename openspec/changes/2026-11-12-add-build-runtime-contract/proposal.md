# build 스킬 런타임 계약 시범 도입 (add-build-runtime-contract)

## Problem

build 스킬이 무엇을 읽고 쓰는지, 어떤 상태와 게이트를 거쳐 어느 스킬로 넘기는지가 `build/SKILL.md` 산문에만 있다.
지금 이를 지키는 테스트는 `laziness-ladder.test.ts`(사다리 문서 언급)와 `build-tier.test.ts`(비용 티어) 뿐이다.
`nereus:e2e` 가 이름을 바꾸거나 `.nereus/evidence.json` 레코드 필드가 바뀌어도 SKILL.md 는 그대로 남고 아무 테스트도 깨지지 않는다.

## Goals

- build 의 산출물·상태·게이트·handoff 를 기계가 읽는 계약 하나로 선언한다.
- 계약이 실제(스킬 디렉터리, SKILL.md 문구, `evidence.mjs` 가 쓰는 레코드)와 어긋나면 테스트가 깨진다.
- 시범 성공 기준: (1) handoff 대상 스킬 이름 변경, (2) evidence 레코드 필드 변경, (3) SKILL.md 게이트 문구 삭제 — 셋 다 이 테스트가 빨갛게 된다.
  성공하면 다른 스킬(spec·review·finish)로 넓힐지 별도 change 에서 정한다.

## Non-Goals

- 다른 스킬의 계약, 훅에서의 런타임 강제, evals.json.
- SKILL.md 본문(§1~§4) 수정. 계약 파일을 가리키는 한 줄만 더한다.

## Design

출처: [NVIDIA/auto-ontology](https://github.com/NVIDIA/auto-ontology) `skills/*/assets/runtime-contract.yaml` (Apache-2.0).
파일을 복사하지 않고 키 구성(workflows·input/output artifacts·required_fields·statuses·gates·handoffs)만 따른다.

- 계약: `plugins/nereus/skills/build/assets/runtime-contract.json` — 스키마와 전체 내용은 spec 과 tasks T2 에 있다.
- 대조: `tests/skills/build-contract.test.ts` 안의 순수 함수 `checkContract(contract, env)` 가 오류 목록을 낸다.
  실제 저장소로 한 번 돌리고(오류 0), 변형한 계약으로 음성 사례를 돌린다(오류 ≥1). 실제 트리를 건드리지 않는다.
- 산출물은 `kind` 로 나눈다. `runtime`(작업 프로젝트에 생기는 파일, 경로 존재를 검사하지 않음)과 `script`(플러그인 안 파일, 존재를 검사).

## Alternatives Considered

| 안 | 버린 이유 |
|---|---|
| YAML (상류 그대로) | 플러그인 런타임은 Node 표준 라이브러리만 쓴다(package.json). YAML 파서를 들일 수 없다 |
| SKILL.md frontmatter 에 넣기 | frontmatter 는 스킬 로더가 name/description 을 읽는 자리다. 계약은 에이전트가 매번 읽을 필요가 없는 내용이라 컨텍스트에 실을 이유가 없다 |
| SKILL.md 산문을 파싱하는 테스트만 | 산문 문장 구조가 바뀔 때마다 깨진다. 무엇이 계약인지 선언이 없다 |
| 기존 `drift` 스킬 확장 | drift 는 OpenSpec 스펙 ↔ 코드 대조다. 스킬 자신의 입출력 선언이 먼저 있어야 drift 가 비교할 대상이 생긴다 |
| 아무것도 안 함 | Problem 의 세 가지 변경이 조용히 통과한다 |

## Risks & Limits

- **두 번째 사본**: 계약과 SKILL.md 가 둘 다 진실이 된다. 완화 — 게이트 `check` 와 상태값은 SKILL.md 의 실제 문구여야 하고(부분 문자열 검사), handoff 는 `nereus:<이름>` 으로 SKILL.md 에 있어야 한다. 한쪽만 고치면 깨진다.
- **역스펙이 오류를 굳힘**: 계약은 현재 SKILL.md 를 옮긴 것이라 SKILL.md 가 틀렸으면 계약도 틀린다. 이 change 는 일관성만 보장한다.
- **검사하지 않는 것**: handoff 의 `when` 문구, 게이트 이름표가 실제 게이트 구현과 연결됐는지는 보지 않는다. `RED`·`GREEN` 같은 짧은 상태 토큰은 SKILL.md 어디서든 맞을 수 있다 — 게이트 문구만 5자 이상으로 제한한다.
- **런타임 미강제**: 에이전트가 계약을 무시해도 막는 것은 없다. 계약은 선언이고 강제는 기존 훅·게이트(`tdd.enforce`, finish 게이트)가 한다. 계약의 `gates` 는 그 기존 게이트를 가리키는 이름표다.
- **패키징**: `assets/` 는 새 디렉터리다. 플러그인 캐시는 스킬 디렉터리 전체를 복사한다(예: `goldfish/personas/`, `goldfish/standards/`)라 별도 설정이 필요 없다.
