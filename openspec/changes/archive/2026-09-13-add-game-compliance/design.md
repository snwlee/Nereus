# design — add-game-compliance

## 결정 1: 이 검사기는 장르 프로파일을 받지 않는다

다른 검사기(sound · liveops · impact · font)는 전부 `profile.<domain>` 에서 기준을 읽는다.
**compliance 는 받지 않는다.**

법적 요건이기 때문이다. 장르별로 설정 가능하게 만들면 `"maxOddsError": 5` 같은 값을 넣어
**설정으로 규정을 끌 수 있다.** 확률 합이 100% 여야 하는 것은 오비든 타이쿤이든 같다.

`Ruling: 법적 요건은 장르 데이터로 두지 않는다 — 설정으로 끌 수 있는 게이트는 게이트가 아니다.`

## 결정 2: 정책 수치는 policy.json 에 출처·확인일과 함께 둔다

장르 프로파일과는 다른 이유다. 장르는 **우리가 정하는 값**이고, 정책은 **남이 정하는 값**이다.
남이 바꾸면 우리가 따라가야 하고, 따라가려면 **언제 확인한 건지** 알아야 한다.

```json
{ "oddsDecimalsForDisclaimer": 4,
  "source": "https://create.roblox.com/docs/production/monetization/paid-random-items",
  "checkedAt": "2026-09-13" }
```

## 결정 3: 무료 랜덤은 검사하지 않는다

로블록스 정책의 명시적 예외다 — "열쇠를 주워 상자를 여는" 식으로 돈을 쓰지 않고 얻는
랜덤 보상은 공개 의무가 없다. `paid: false` 면 확률 검사를 통째로 건너뛴다.

**이것을 넓게 잡으면 안 된다.** 인게임 화폐라도 **Robux 로 살 수 있으면 유료**다.
간접 구매(열쇠·스핀 티켓)도 유료다. 그래서 `paid` 는 "Robux 가 어딘가 끼어 있는가"로 판단한다.

## 결정 4: 공개 표면은 시장 데이터다

한국 게임산업법은 **게임·웹사이트·광고** 세 곳 표시를 요구한다. 로블록스 정책은 게임 내를 요구한다.
시장마다 다르므로 `policy.json` 의 `markets` 에 데이터로 두고, 계획의 `markets` 와 대조한다.
시장이 늘면 데이터만 는다.

## 결정 5: 확률 합 판정과 부동소수점

확률을 더하면 부동소수점 오차가 난다(0.1 + 0.2 ≠ 0.3). 합을 그대로 100 과 비교하면
**정상인 계획이 위반으로 잡힌다.** 소수 6자리로 반올림해 비교한다.

4자리 이상 소수를 쓰는 계획은 반올림 때문에 합이 100 이 안 될 수 있고, 그때는 면책 문구
(`roundingDisclaimer`)가 있어야 통과한다 — 공식 문서가 허용하는 경로다.

## 파일 배치

```
plugins/nereus-game/
├── policy.json                  (신규)
├── lib/compliance-check.mjs     (신규)
├── skills/compliance/SKILL.md   (신규)
├── skills/balance/SKILL.md      (포인터)
└── nereus-extension.json        (라우트 1개)
```
