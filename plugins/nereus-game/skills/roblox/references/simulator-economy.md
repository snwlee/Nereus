# 시뮬레이터 경제 — 서버가 모든 금액을 소유한다

> 출처: awesome-gamedev-agent-skills (@ 19d93f9) `skills/other-engines/roblox-simulator-economy` — Copyright 2026 Abhishek Barali and contributors, Apache-2.0
> (`plugins/nereus-game/LICENSES/Apache-2.0.txt`). 판단 지식만 골라 한국어로 다시 썼다. API 시그니처·수치 한도는 바뀌므로
> 여기 적지 않는다 — 내장 Studio MCP 의 API 문서와 create.roblox.com 이 진실이다.

수치 설계(가격 곡선·환생 비율·오프라인 상한)는 엔진과 무관하므로 `nereus-game:balance` 의
`economy-curve.mjs` 로 **먼저** 판정한다. 이 장은 그 수치를 로블록스 서버에 옮길 때의 판단이다.

## 1. 수식은 한 벌만

`templates/economy_math.luau` 를 **고치지 않고** ModuleScript 로 넣는다(`ReplicatedStorage/Shared/EconomyMath`).
테스트한 수식이 실행되는 수식이어야 한다. 테스트는 `templates/test_economy_math.luau` — 순수 Luau 라 lune 1단에서 돈다:

```bash
lune run test_economy_math.luau   # 프로젝트 rokit 매니페스트에 lune 이 있어야 한다
```

수치 표(`EconomyConfig`)는 한 테이블로 두고 서버·클라가 같이 읽는다. 클라가 가격·확률을 보여주는 데 쓰는 것은 안전하다 —
서버가 클라의 금액을 읽지 않기 때문이다.

## 2. 구매·환생

- Remote 는 업그레이드 **id** 만 싣는다. 서버가 가격을 찾고, 잔액을 확인하고, 차감하고, 지급한다 — **그 사이에 양보 없이.**
  (`references/remote-validation.md §4`)
- 다중 화폐 비용은 전부 확인한 뒤 하나라도 차감한다(`trySpend`). 음수·비유한 비용은 거절한다.
- buy max 는 `maxLevel` 상한이 있는 걷기다. 가격 0 이면 루프가 서버를 멈춘다(`maxAffordable` 은 던진다).
- 환생은 서버가 자기 잔액을 요구치와 비교한 뒤 지갑·레벨을 초기화하고 횟수를 올린다. "환생했다"나 잔액을 클라에서 받지 않는다.
- Remote 마다 플레이어별 토큰 버킷.

## 3. 로드 수리와 오프라인 시간

- **로드에서 던지지 않고 고친다.** 숫자가 아님·NaN·무한·음수 → 0, 소수 → 바닥, 레벨은 현재 `maxLevel` 로 자르고,
  모르는 업그레이드 id 는 버리고, 무엇을 고쳤는지 목록을 남긴다(`sanitizeAmount` · `sanitizeLevel`).
- NaN·무한을 저장하지 않는다. 같은 정화기를 저장 직전에도 건다.
- 오프라인 시간은 **서버 시계만** 쓴다. 퇴장 때 서버 `os.time()` 을 저장하고 접속 때 차이를 잰다.
  없거나 미래인 `lastSeen` 은 지금으로 친다 — 0 을 준다.
- 잔액이 1e15 를 넘을 수 있으면 가수·지수 쌍이나 log10 으로 저장한다(`checkPacing` 의 `precision`).

## 4. 큰 수 표기

`formatNumber` 는 클라에서 **표시용으로만**. 서식 문자열을 다시 숫자로 파싱하지 않는다.
반올림을 먼저 해야 한다 — 거꾸로 하면 HUD 에 `1000.0K` 가 뜬다.

## 5. 유료 확률 아이템(알·상자·스핀)

Robux 로, 또는 Robux 로 산 화폐로 사는 확률 아이템은 플랫폼 규정 대상이다. **판정은 `nereus-game:compliance` 가 한다** —
확률 공개·합계·럭/천장 수치 설명·제한 지역 대체 경로. 여기서는 배선만:

- 확률 패널(`oddsPercent`)과 서버 롤(`pickWeighted`)이 **같은 목록**을 읽게 한다. 부스트는 새 가중치 목록을 만들어 둘 다에 넘긴다 —
  보여준 확률과 실제 확률이 어긋날 수 없게.
- 제한 대상 플레이어 판정은 `PolicyService` 결과로 하고, 대체 처리는 compliance 판정을 따른다.
