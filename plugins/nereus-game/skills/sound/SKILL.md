---
name: sound
description: 사운드 설계 — 오디오 예산·믹스·피드백 커버리지·적응형 음악. 생성은 asset 이 한다. 트리거 "사운드 설계", "믹스", "오디오 예산", "동시 발음", "라우드니스".
---

# sound

nereus:common 규칙을 따른다. 담당 에이전트: art-director.
**엔진과 무관하다** — 로블록스든 Unity든 Switch든 같은 기준으로 판정한다.

## 0. asset 과의 경계

| | 담당 |
|---|---|
| 소리를 **만드는** 것 (TTS·SFX·BGM 생성, 포맷 변환, 반입) | `nereus-game:asset` |
| 만든 소리를 **어떻게 쓸지** (예산·배치·피드백·믹스) | 여기 |

합치지 않는 이유: `asset` 의 범위는 "엔진 반입 직전까지"다. 사운드 설계는 반입 **이후**의 문제다.
소리가 전부 있어도 동시 발음수가 터지거나 같은 SFX 가 반복되면 게임은 여전히 나쁘게 들린다.

## 1. 계획을 JSON 으로 적는다

```json
{
  "maxConcurrent": 12,
  "loudnessLufs": -14,
  "cues": [
    { "name": "jump", "variants": 3, "actions": ["jump"] },
    { "name": "coin", "variants": 4, "actions": ["pickup", "purchase"] }
  ],
  "actions": ["jump", "pickup", "purchase", "land"]
}
```

- `actions` 는 플레이어가 하는 **모든** 동작이다. 여기 있는데 어떤 큐에도 매핑되지 않으면
  그 동작은 소리 없이 일어난다 — 검사기가 `no-feedback` 으로 잡는다.
- `variants` 를 1 로 두지 않는다. 같은 소리가 반복되면 몇 분 만에 귀에 띈다.

## 2. 검사

```bash
echo '{"genre":"obby-platformer","plan":{...}}' | node "${CLAUDE_PLUGIN_ROOT}/lib/sound-budget.mjs"
```

기준은 장르 프로파일의 `sound` 키에서 온다 — 스킬 안에 수치를 박지 않는다.
프로파일에 `sound` 기준이 없으면 통과가 아니라 `no-baseline` 이 나온다.
**조용한 통과는 없는 게이트보다 나쁘다.**

| 위반 코드 | 뜻 |
|---|---|
| `no-baseline` | 장르 프로파일에 `sound` 기준이 없다 |
| `concurrency` | 동시 발음수가 상한을 넘는다 |
| `variants` | 그 큐의 변형이 최소 개수 미만이다 |
| `loudness` | 라우드니스가 목표 범위 밖이다 |
| `no-feedback` | 그 동작에 대응하는 큐가 없다 |

## 3. 적응형 음악

상태 전이를 **선언**하고, 각 전이에 도달 조건과 복귀 조건을 같이 적는다.
복귀 조건이 없는 전이는 한 번 들어가면 못 나오는 상태다 — 라이브옵스의 롤백 경로와 같은 문제다.

## 4. 접근성

소리로만 전달하는 정보가 있으면 시각 대체를 같이 둔다.
소리를 못 듣는 환경(음소거·청각 장애)에서 그 정보가 사라지면 그건 설계 결함이다.
