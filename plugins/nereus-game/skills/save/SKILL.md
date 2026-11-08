---
name: save
description: 세이브 설계 — 버전 필드·마이그레이션 체인·원자적 쓰기·백업·자동저장 슬롯을 소실 경로로 판정한다. 트리거 "세이브", "저장 슬롯", "자동 저장", "세이브 마이그레이션", "진행도 소실".
---

# save

nereus:common 규칙을 따른다. 담당 에이전트: gameplay-engineer.
**엔진과 무관하다** — 저장 위치·API 는 엔진 스킬이 갖고, 여기서는 "무엇이 진행도를 날리는가"만 본다.

출처: awesome-gamedev-agent-skills `disciplines/save-systems` (Apache-2.0). 체크리스트를 판정으로 다시 썼다.

## 왜 검사기인가

세이브 소실은 **되돌릴 수 없고 출시 뒤에 드러난다.** 패치가 기존 세이브를 못 읽거나, 저장 중 크래시가
잘린 파일을 남기거나, 자동저장이 수동 슬롯을 덮는다. 셋 다 개발 중에는 재현되지 않는다.
그래서 구현을 보기 전에 **계획**을 판정한다.

## 1. 계획을 데이터로 적는다

```json
{
  "currentVersion": 3,
  "migrations": [1, 2],
  "write": "atomic-rename",
  "backup": true,
  "autosave": { "separateSlot": true },
  "newerVersion": "refuse",
  "fixtures": [1, 2, 3],
  "fields": [{ "name": "coins" }, { "name": "seed" }, { "name": "dps", "derived": true }]
}
```

- `migrations` — vN→vN+1 함수가 있는 N 목록. 순수 함수로, **영원히 지우지 않는다**(지우면 그 버전 세이브가 고립된다).
- `fixtures` — 출시한 버전마다 실제 세이브 표본. 아직 안 낸 버전이 있으면 `shippedVersions` 로 좁힌다.
- `fields[].derived` — 다른 값에서 계산되는 값. 저장하지 않고 로드 때 다시 계산한다.

## 2. 돌린다

```bash
echo '{"plan": { ... }}' | node plugins/nereus-game/lib/save-check.mjs
```
JS 에서는 `checkSave(plan)`.

| 위반 | 뜻 | 대응 |
|---|---|---|
| `no-version` | 버전 필드 없음 | v1 부터 정수 `version` 을 찍는다 |
| `migration-gap` | 빠진 단계(`missing`) | 그 단계 함수를 쓴다. 한 방에 최신으로 바꾸는 함수로 대체하지 않는다 |
| `fixture-gap` | 회귀 표본이 없는 버전 | 그 버전 빌드로 세이브를 만들어 테스트 코퍼스에 넣는다 |
| `in-place-write` | 제자리 쓰기 | 임시 파일에 쓰고 교체(rename)한다 |
| `no-backup` | 정상본 없음 | 교체 전에 `.bak` 으로 남기고, 주 파일 실패 시 그것을 읽는다 |
| `autosave-clobber` | 자동저장이 수동 슬롯을 덮음 | 자동저장 전용 슬롯(가능하면 2~3개 순환) |
| `newer-not-refused` | 더 새 빌드 세이브를 읽으려 함 | 거부하고 알린다. 모르는 필드를 추측하지 않는다 |
| `derived-stored` | 파생 값 저장 | 원천만 저장한다 |

## 3. 로드 순서

읽기 → 버전 확인(새 것이면 거부) → 마이그레이션 → 검증 → 객체 재구성.
검증은 필수 키·타입·범위(NaN·무한·음수)·현재 콘텐츠에 없는 id(패치로 지운 아이템)를 본다.
실패하면 백업으로, 그것도 실패하면 **조용히 기본값으로 시작하지 말고** 플레이어에게 알린다 —
기본값으로 시작한 세션이 저장되는 순간 진짜 진행도가 덮인다.

## 하지 말 것

- 엔진 객체·노드 경로를 직렬화하지 않는다. 데이터를 저장하고 로드 때 재구성한다.
- 로컬 세이브를 온라인 상태의 근거로 쓰지 않는다. 플레이어가 고칠 수 있는 파일이다.
- 세이브 파일에서 스크립트가 붙은 객체를 역직렬화하지 않는다. 세이브는 공유되고, 로드가 곧 실행이 된다.
- 클라우드 저장(DataStore 등)의 세션 잠금·쿼터는 엔진 스킬 자료를 본다 — 로블록스는 `nereus-game:roblox` 의 `references/datastores.md`.
