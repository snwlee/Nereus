# 역스펙 (브라운필드 → OpenSpec 기준선)

기존 코드에서 동작 스펙을 뽑아 `openspec/specs/<capability>/spec.md`를 만든다.
목적: 이후 변경의 델타(ADDED/MODIFIED/REMOVED)가 참조할 기준 진실. 출처: ecc `spec-miner`를 Nereus에 맞춰 압축.

담당: architect. **읽기 전용**으로 동작한다 — 코드를 고치지 않는다. 불확실하면 추측하지 않고 `uncertainty`로 남긴다.

## 1. 범위 묶기 (작게 시작)

1. 진입점부터 본다: 라우터·컨트롤러·서비스 파사드·공개 API. 진입점의 1차 의존성을 읽고 같은 서비스 네임스페이스를 공유하는 것끼리 capability로 묶는다 (`orders`, `user-auth` 같은 kebab-case).
2. capability 목록을 사용자에게 보이고 어디부터 캘지 정한다. 모노레포 전체를 한 번에 캐지 않는다.

## 2. 캐기 (sample-and-expand)

1. **Sample**: 진입 파일부터 읽는다. 동작 주장의 ~70%가 여기 있다.
2. **Expand**: 찾은 동작마다 호출 체인을 한 단계만 내려가 검증한다. 다음 중 하나에 걸리면 멈춘다: 외부 경계(DB·HTTP·큐)에 닿음 / 연속 3개 파일에서 새 주장 없음 / capability당 15파일.
3. **Defer**: 못 읽은 파일은 spec 하단에 `<!-- deferred: file1, file2 -->`로 남기고 다음 세션에 넘긴다.
4. 캐는 원천: 공개 함수 시그니처·가드/얼리 리턴·상태 전이·도메인 검증·계산·권한 체크·assert와 DB 제약·이벤트/사이드이펙트·보상(롤백) 로직. 코드가 강제하면 카테고리 불문하고 기록한다.
5. **교차 검증**: docstring이 아니라 호출자가 의존하는 실제 계약을 적는다.

## 3. 쓰기 (평탄 포맷)

**CLI 가 받는 뼈대를 먼저 맞춘다.** 아래 세 가지는 취향이 아니라 `openspec validate` 통과 조건이다
(1.12 기준, 이 사이클에서 세 번 걸렸다).

1. 스펙 파일은 `## Purpose` 와 `## Requirements` 섹션을 가진다. 제목과 `Last verified:` 뒤에
   `## Purpose` 한 문단을 두고, 모든 `### Requirement:` 는 `## Requirements` 아래에 넣는다.
2. **`### Invariant:` 를 쓰지 않는다.** CLI 는 `###` 을 전부 Requirement 로 파싱해 Scenario 를
   요구하므로 Invariant 는 검증 실패로 떨어진다. 항상 참인 것도 `### Requirement:` 로 쓰고
   `<!-- invariant -->` 주석으로 표시한 뒤 Scenario 를 하나 붙인다(불변을 깨는 시도가 어떻게
   되는지가 그 Scenario 다).
3. 변경 델타 파일(`openspec/changes/<id>/specs/<capability>/spec.md`)은 `## ADDED Requirements`
   `## MODIFIED Requirements` `## REMOVED Requirements` 같은 **델타 헤더**를 쓴다. 기준선 스펙의
   `## Requirements` 를 그대로 쓰면 델타로 인식되지 않는다.

그 안에서는 `### Requirement:`(트리거 있음: WHEN → THEN)만 둔다. "API 계약", "비즈니스 규칙" 같은 타입 챕터 금지. Requirement는 `#### Scenario:`를 최소 1개 가진다.

```markdown
### Requirement: 재고 부족 시 에러 반환
<!-- id: InventoryService.decrement -->
<!-- entities: Order, Inventory -->
<!-- enforced: InventoryService.decrement() -->

재고가 부족하면 시스템은 반드시 `INSUFFICIENT_STOCK` 에러를 반환해야 한다.

#### Scenario: 부족분 주문
<!-- test: InventoryServiceTest.decrementsStock() -->
- **WHEN** 주문 수량이 가용 재고를 초과한다
- **THEN** `INSUFFICIENT_STOCK` 에러를 반환하고 재고는 그대로 둔다
```

메타데이터 규칙: `id`는 최상류 강제점(`FileName.methodName`)에서 따고, 사람이 읽는 이름이 바뀌어도 안 바뀐다. 모르면 비워 둔다(추측 금지). `entities`·`enforced`는 알면 필수. `depends_on`·`triggers`는 같은 파일 안의 직접 추적 가능한 동기 관계만. `Last verified: YYYY-MM-DD (commit abc1234)`를 적는다.

## 하지 말 것

- 타입 챕터 만들기, 파일 구조 설명하기, docstring 베껴 적기, 생성·벤더 코드 스펙화, 모듈 전체 한 번에 캐기, `###`을 Requirement 외에 쓰기.
- 광산꾼은 리팩터링하지 않는다. 코드 모순은 고치지 말고 `<!-- uncertainty: 이유 -->`로 남긴다.
- 500줄을 넘기면 capability가 너무 넓다 — 쪼갠다.
