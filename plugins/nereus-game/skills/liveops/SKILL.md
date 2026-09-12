---
name: liveops
description: 라이브옵스 — 이벤트 캘린더·경제 싱크/소스·리텐션 가정·롤백 경로를 정합성으로 판정한다. 트리거 "라이브옵스", "이벤트 캘린더", "리텐션", "시즌", "운영 지표", "롤백".
---

# liveops

nereus:common 규칙을 따른다. 담당 에이전트: architect.
**엔진과 무관하다** — 로블록스든 Unity든 Switch든 계획의 정합성은 같은 기준으로 본다.

시뮬레이터·타이쿤과 오비는 **출시가 시작**인 장르다. 만드는 것까지만 덮는 하네스는
이 장르에서 절반만 쓸모 있다.

## 0. 지표는 주입구다 — 없다고 게이트가 꺼지지 않는다

실제 운영 지표(로블록스 Open Cloud Analytics 등)는 아직 연결돼 있지 않다.
그래도 **계획의 내적 정합성**은 지표 없이 판정할 수 있다.

| 검사 | 지표 필요 | 없을 때 |
|---|---|---|
| 이벤트 구간 겹침 | 아니오 | 그대로 판정 |
| 경제 싱크/소스 균형 | 아니오 | 그대로 판정 |
| 리텐션 곡선 형태 | 아니오 | 그대로 판정 |
| 롤백 경로 존재 | 아니오 | 그대로 판정 |
| 실측 리텐션 편차 | **예** | `unmeasured` 에 `retention-actual` 로 남는다 |

`Ruling: 미설정과 실패를 구분한다` 의 도메인 적용이다. 지표가 생기면 `metrics` 를 채우면 된다 —
검사기를 고치지 않는다.

## 1. 계획을 JSON 으로 적는다

```json
{
  "events": [
    { "name": "halloween", "start": 1, "end": 5, "rollback": "이벤트 플래그 off + 보상 지급 중단" },
    { "name": "winter", "start": 6, "end": 9, "rollback": "이벤트 플래그 off" }
  ],
  "economy": {
    "sources": [{ "name": "quest", "amount": 100 }],
    "sinks": [{ "name": "shop", "amount": 90 }]
  },
  "retention": { "d1": 0.4, "d7": 0.2, "d30": 0.1 }
}
```

구간은 **반열린 구간** `[start, end)` 다. 앞 이벤트의 `end` 와 뒤 이벤트의 `start` 가 같은 것은 겹침이 아니다.

## 2. 검사

```bash
echo '{"genre":"sim-tycoon","plan":{...}}' | node "${CLAUDE_PLUGIN_ROOT}/lib/liveops-plan.mjs"
```
실측 지표가 있으면 같은 JSON 에 `"metrics": { "retention": { "d1": 0.38, "d7": 0.19, "d30": 0.1 } }` 를 넣는다.

| 위반 코드 | 뜻 |
|---|---|
| `overlap` | 두 이벤트의 구간이 겹친다 |
| `no-rollback` | 그 이벤트에 롤백 경로 선언이 없다 |
| `no-sink` | 경제에 소스만 있고 싱크가 없다 — 인플레가 확정돼 있다 |
| `retention-shape` | 리텐션 가정이 뒤로 갈수록 올라간다 |
| `retention-drift` | 실측이 가정에서 장르 허용치보다 멀다 |

허용치는 장르 프로파일의 `liveops.retentionDriftPct` 에서 온다.

## 3. 롤백 경로는 선택이 아니다

라이브 게임에서 되돌릴 수 없는 이벤트는 사고다. 각 이벤트에 "무엇을 끄면 원상복구되는가"를
한 줄로 적는다. 적을 수 없다면 그 이벤트는 아직 설계가 끝나지 않은 것이다.
