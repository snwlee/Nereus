# design — add-l10n-harness

## 1. 열린 질문 둘의 확정

### Q1. 86 미달을 위반으로 볼 것인가 → **아니다. `coverage` 로 낸다**

게이트가 "86 미만은 위반"이면 현재 프로덕션 16개 플레이버가 **즉시 전부 빨개진다**.
`Ruling: 끄게 만드는 게이트는 게이트가 아니다`(ToonTone 461:0 사건)가 그대로 적용된다.

대신 **선언과 실제의 어긋남**만 게이트로 낸다:

| | 판정 |
|---|---|
| 요구 집합(86) 중 안 채운 로케일 | `coverage.missing` — **위반 아님** |
| **선언한** 로케일인데 필드가 빈 것 | `declared-but-empty` — **위반** |
| 전 로케일 동일 문자열인데 사유 선언 없음 | `untranslated-undeclared` — **위반** |

미달은 진행 상태이고, **선언과 실제가 어긋난 것이 결함이다.**
`Ruling: 제외는 삭제가 아니라 분류다` — 빠진 로케일은 이유와 함께 `skipped` 로 센다.

**미설정의 기본 방향은 보호다**: 대상 로케일을 선언하지 않으면 요구 집합을 **Play 전체 86** 으로 본다.
선언하지 않은 것을 "영어만 하면 된다"로 읽으면 조용히 최악으로 떨어진다.

### Q2. 두부 검출을 하네스가 직접 할 것인가 → **아니다. 증거를 요구한다**

폰트 파싱은 새 런타임 의존성(fontTools 류)을 부른다 — Global Constraint 위반이다.
그리고 하네스가 파싱해도 **실제 렌더러가 쓰는 폰트와 다를 수 있다**. 도너가 당한 것은
"폰트에 글리프가 없다"가 아니라 **"PIL 이 `.notdef` 를 그리고 exit 0 했다"** 이다.
검증은 **렌더 직후 그 자리에서** 해야 의미가 있다.

그래서 프로젝트가 `glyphCheck: { ranAt, tool, missing: [...] }` 를 **증거로 준다**.
없으면 `tofu-unverified` 다. **미설정을 통과로 읽지 않는다** — 성공처럼 보이는 것이 정확히 그 사고였다.

## 2. 게이트와 조언자를 파일로 나눈다

`Ruling: 게이트와 조언자는 파일을 나눈다`(nereus-ads). 여기서도 같다 —
"잘린 채 발행됨"과 "브라질을 먼저 채우면 좋겠음"이 같은 무게로 나오면 진짜가 묻힌다.

```
lib/store-l10n-check.mjs   → { violations, coverage, skipped }
lib/aso-advisor.mjs        → { levers, unanswerable }
lib/l10n-scan.mjs          → { violations, skipped }        (이관)
lib/font-check.mjs         → { violations }                  (이관)
lib/cli-input.mjs          → 이 플러그인의 것                 (복제, import 금지)
```

`coverage` 가 게이트 쪽에 있는 이유: 위반 판정의 **분모**라서다. 조언자로 넘기면
"무엇을 검사했는가"와 "무엇을 권하는가"가 갈라진다.

## 3. 로케일 데이터 — 추정의 출처를 필드마다 표시한다

`locales.json` 은 86 행이 된다. 문제는 **`expansion` 을 86개 지어낼 수 없다**는 것이다.
`Ruling: 근사는 근사라고 표시한다` 를 필드 단위로 적용한다.

```json
{
  "source": "https://support.google.com/googleplay/android-developer/answer/9844778",
  "checkedAt": "2026-09-13",
  "howCounted": "페이지 HTML 의 목록 블록을 파싱해 행을 셌다 — 86행·고유코드 86·중복 0·파싱실패 0. 같은 페이지 요약 질의는 110·86·176 으로 갈렸다. 요약을 믿지 않는다.",
  "base": "en",
  "locales": {
    "ko-KR": { "label": "Korean", "script": "hangul", "direction": "ltr",
               "expansion": 0.8, "expansionBasis": "legacy-estimate",
               "avgCharWidth": 1.0, "avgCharWidthBasis": "script-default" }
  }
}
```

| `expansionBasis` | 뜻 |
|---|---|
| `legacy-estimate` | 기존 8종에 있던 값. 업계 통념 추정 |
| `group-estimate` | 스크립트·어족 그룹의 대표값을 물려받았다 |
| `measured` | 실측이 생기면 여기로 올린다 |

**기본값으로 조용히 떨어지지 않는다.** `expansion` 이 없는 로케일은 없고,
있다면 그 값이 어디서 왔는지 필드가 말한다. 폭 위반에는 기존대로 `approx: true` 가 붙는다.

`avgCharWidth` 는 `expansion` 과 **다른 축**이다(기존 note 그대로) — 한글은 글자 수가
줄지만(expansion 0.8) 글자당 폭은 전각이라 라틴의 두 배다(avgCharWidth 1.0). 섞지 않는다.

## 4. 필드 길이 제한은 스토어별 데이터다

```json
"stores": {
  "play": {
    "source": "...", "checkedAt": "2026-09-13",
    "localeCodeStyle": "bcp47-region",
    "fields": { "title": 30, "shortDescription": 80, "fullDescription": 4000 }
  },
  "appStore": { "note": "이번 범위 밖. 자리만 둔다 — 코드 형식과 길이 제한이 다르다." }
}
```

**스토어별 표로 둔다.** App Store 는 로케일 코드가 `ko`·`zh-Hans` 라 Play 의 `ko-KR`·`zh-TW` 와
다르다. 한 벌로 뭉치면 나중에 반드시 갈린다.

`localeCodeStyle` 이 `locale-code-unknown` 판정의 근거다 — 코드를 하드코딩하지 않는다.

## 5. 번역하지 않기로 한 것은 **선언**해야 한다

이 설계의 핵심이다.

```json
"doNotTranslate": [
  { "field": "title", "why": "앱 이름이 검색 키워드다. 번역하면 그 키워드로 오던 유입이 끊긴다" }
]
```

선언이 있으면 전 로케일 동일 문자열이 **정상**이다. 선언이 없으면 `untranslated-undeclared` 다.
`Ruling: 경계·분류 선언에 why 를 빼지 않는다 — 이유 없는 경계가 가장 먼저 지워진다.`

하네스는 **번역할지 말지를 정하지 않는다.** 오너가 "판단에 따라서 해야 하는 것"이라고 명시했다.
하네스가 강제하는 것은 **판단했다는 사실이 기록에 남는 것**뿐이다.

조언자는 그 판단을 돕는 신호만 낸다 — 그리고 답할 수 없는 것을 같이 낸다:

| 답할 수 없는 질문 | 왜 |
|---|---|
| 번역한 제목이 실제로 유입을 늘리나 | Play Console 검색 유입 데이터가 필요하다. 등재 텍스트로는 알 수 없다 |
| 어느 로케일을 먼저 채울까 | 로케일별 매출·설치 점유가 필요하다. **실측치는 입력으로 받는다** |
| 번역 품질이 충분한가 | 하네스는 문자열의 존재와 길이만 본다. 의미는 안 본다 |

## 6. 이관 — `nereus-game` 에 남기는 것

| 무엇 | 어디로 | 어떻게 |
|---|---|---|
| `l10n-scan.mjs` (게임 토큰 0) | `nereus-l10n` | 그대로 이관 |
| `font-check.mjs` 의 스크립트·용량·최소크기 | `nereus-l10n` | 이관 |
| `embedding "game"` 하드코딩 | `nereus-l10n` | **`requiredEmbedding` 입력으로 일반화** |
| 장르 폰트 예산 | `nereus-game` | 게임이 값을 주입한다 |
| `locales.json` | `nereus-l10n` | 이관 + 86 확장 |

**`requiredEmbedding` 의 기본값은 없애지 않는다.** 안 주면 `"game"` 이 아니라
**`null` 이고, null 이면 라이선스 검사를 건너뛰는 것이 아니라 "요구 임베딩 미선언"으로 낸다.**
미설정을 허용으로 읽지 않는다 — 기존 invariant("선언이 없으면 허용으로 치지 않는다")를 유지한다.

`nereus-game` 은 `nereus-extension.json` 의 `companions` 로 `nereus-l10n` 을 건다.
**형제 플러그인의 검사기를 호출하지 않는다** — 설치 조합에 따라 조용히 깨진다.

## 7. 라우트를 좁힌다 — 플러그인이 넷이 된다

`MAX_HITS=2` 인데 후보가 넷이다. `번역`·`언어` 단독 단어는 **쓰지 않는다**.

| 스킬 | 잡는 것 |
|---|---|
| `l10n` | `현지화` · `l10n` · `로케일` · `locale` · `다국어` · `하드코딩 문자열` · `ARB` |
| `storelisting` | `스토어 등재` · `등재 텍스트` · `앱 제목` · `패치노트` · `스크린샷 문구` · `ASO` |
| `typeface` | `폰트 커버리지` · `두부` · `tofu` · `글리프` · `스크립트 커버리지` · `RTL` |

`nereus-game:localization` 은 남으므로 **두 스킬 이름이 겹치면 안 된다** →
새 스킬 이름을 `localization` 이 아니라 `l10n` 으로 한다.
`Ruling: 에이전트·스킬 이름은 플러그인 간에 겹치면 안 된다.`

에이전트 이름은 `l10n-engineer` — 기존 넷(`ads-engineer` 포함)과 겹치지 않는다.
