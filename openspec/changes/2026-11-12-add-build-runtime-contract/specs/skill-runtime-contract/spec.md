# skill-runtime-contract

스킬이 읽고 쓰는 것·상태·게이트·handoff 를 JSON 계약으로 선언하고, 계약과 실제의 어긋남을 테스트로 잡는다. 시범 대상은 build.

## ADDED Requirements

### Requirement: build 스킬은 런타임 계약을 선언해야 한다
<!-- id: contract.buildDeclared -->
<!-- entities: Skill -->
<!-- enforced: tests/skills/build-contract.test.ts (이 change 에서 생성) -->

`plugins/nereus/skills/build/assets/runtime-contract.json` 은 정확히 다음 9개 최상위 키를 가진다(더 많지도 적지도 않다). `skill` 은 `"build"`, `schema_version` 은 `1` 이다.

| 키 | 형태 | 뜻 |
|---|---|---|
| `schema_version` | 정수 `1` | 계약 형식 버전. 키가 바뀌면 올린다 |
| `skill` | `"build"` | 스킬 디렉터리 이름 |
| `source` | `{repo, path, license}` | 차용 출처 |
| `workflows` | `{이름: {input: 산출물[], output: 산출물[]}}` | 스킬이 하는 일의 단위 |
| `artifacts` | `{이름: {kind: "runtime"\|"script", path}}` | 읽거나 쓰는 파일. `runtime` 은 작업 프로젝트 기준, `script` 는 플러그인 루트(`plugins/nereus`) 기준 |
| `required_fields` | `{산출물: [필드]}` | 산출물이 JSON 레코드일 때 반드시 있는 필드 |
| `statuses` | `[문자열]` | 스킬이 쓰는 상태값. 각각 SKILL.md 에 그대로 나온다 |
| `gates` | `[{id, check, script?}]` | 넘어가기 전 조건. `check` 는 SKILL.md 의 문구 그대로, `script` 는 플러그인 루트 기준 경로 |
| `handoffs` | `[{when, to}]` | 다른 스킬로 넘기는 조건. `to` 는 `nereus:<스킬>` |

build/SKILL.md 는 `assets/runtime-contract.json` 을 언급한다.

#### Scenario: 계약 파일과 안내
- **WHEN** build 스킬을 읽는다
- **THEN** SKILL.md 가 `assets/runtime-contract.json` 을 언급하고 파일이 그 경로에 있다

#### Scenario: 최상위 키 누락
- **WHEN** 계약에서 `gates` 를 뺀다
- **THEN** 검사가 오류를 낸다

### Requirement: 계약은 실제와 어긋나면 안 된다
<!-- id: contract.noDrift -->
<!-- entities: Skill -->
<!-- enforced: tests/skills/build-contract.test.ts (이 change 에서 생성) -->

검사 `checkContract` 는 다음을 확인한다. 실제 저장소에 대해 오류 0 이어야 한다.

1. workflows 의 input/output 은 모두 `artifacts` 에 선언된 이름이다.
2. `required_fields` 의 키는 모두 선언된 산출물이다.
3. `kind: "script"` 산출물과 `gates[].script` 경로가 플러그인 루트 아래 존재한다.
4. `statuses` 와 `gates[].check` 는 각각 SKILL.md 의 부분 문자열이다. `gates[].check` 는 5자 이상이어야 한다(짧은 토큰이 우연히 맞는 것을 막는다). `statuses` 는 SKILL.md §1·§2 의 TDD 상태와 evidence 상태 중 SKILL.md 에 적힌 것이다.
5. `handoffs[].to` 는 `nereus:<이름>` 형태이고, `plugins/nereus/skills/<이름>/SKILL.md` 가 존재하며, 그 문자열이 build/SKILL.md 에 있다.
6. `EvidenceRecord` 의 `required_fields` 는 `recordEvidence`(plugins/nereus/hooks/scripts/lib/evidence.mjs)가 실제로 돌려주는 레코드의 키와 집합으로 같다(순서 무관). 키는 하드코딩하지 않고 `recordEvidence` 를 no-op `writeFile` 로 호출해 얻는다.

#### Scenario: 선언하지 않은 산출물
- **WHEN** workflow output 에 `artifacts` 에 없는 이름을 넣는다
- **THEN** 오류

#### Scenario: handoff 대상 스킬 없음
- **WHEN** handoff `to` 를 `nereus:no-such-skill` 로 바꾼다
- **THEN** 오류

#### Scenario: 스크립트 경로 없음
- **WHEN** gate `script` 를 존재하지 않는 경로로 바꾼다
- **THEN** 오류

#### Scenario: SKILL.md 에 없는 게이트 문구
- **WHEN** gate `check` 를 SKILL.md 에 없는 문장으로 바꾼다
- **THEN** 오류

#### Scenario: evidence 레코드 필드 불일치 (계약 쪽)
- **WHEN** `EvidenceRecord` 필드에 `recordEvidence` 가 쓰지 않는 `duration` 을 넣는다
- **THEN** 오류

#### Scenario: evidence 레코드 필드 불일치 (코드 쪽)
- **WHEN** `recordEvidence` 가 새 키를 쓰기 시작한다(테스트에서는 `evidenceKeys` 에 키를 더해 흉내낸다)
- **THEN** 실제 계약 검사가 오류를 낸다

#### Scenario: handoff 대상이 SKILL.md 에 없음
- **WHEN** handoff `to` 를 존재하지만 build/SKILL.md 가 언급하지 않는 `nereus:pdf` 로 바꾼다
- **THEN** 오류
