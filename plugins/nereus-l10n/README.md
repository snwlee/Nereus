# nereus-l10n

현지화 하네스. `nereus` 코어의 워크플로(intake → spec → build → review → finish) 위에서
**현지화 도메인만** 담당한다. 게임·비게임을 가리지 않는다.

## 왜 별도 플러그인인가

제품이 사용자에게 닿는 표면은 셋인데, 지금까지 검사받은 건 하나뿐이었다:

| 표면 | 이전 | 지금 |
|---|---|---|
| 소스 코드 문자열 | `nereus-game` 안 | `l10n` |
| 스토어 등재 텍스트 | **아무도 안 봄** | `storelisting` |
| 스토어 이미지 안 텍스트 | **아무도 안 봄** | `storelisting` + `typeface` |

그리고 더 중요한 것: **무엇을 번역하지 *않을* 것인가**가 아무 데도 기록되지 않았다.

### 게임 플러그인에 있던 것이 잘못이었다

측정했다(2026-09-13):

| 파일 | 줄 | 게임 고유 토큰 |
|---|---|---|
| `l10n-scan.mjs` | 99 | **0건** |
| `font-check.mjs` | 81 | **2곳** — 임베딩 종류, 장르 예산 |

`localization` 스킬에 자막·대사·더빙 언급은 **0건**이었다(대사 현지화 대비는
`nereus-game:narrative` §4 가 갖는다). 비게임 제품은 `nereus-game` 을 깔 이유가 없고,
깔지 않으면 **현지화 검사가 통째로 없었다.**

집을 `nereus-store` 로 잡지 않은 이유: **스토어 등재는 현지화의 한 표면이지 그 반대가 아니다.**
`store` 로 잡으면 소스 l10n 검사기가 들어갈 자리가 없어 게임 플러그인에 남고,
플러그인 간 import 금지 때문에 **로케일 집합이 두 벌이 된다. 두 벌이면 반드시 갈린다.**

## 세 스킬

| 스킬 | 성격 | 검사기 |
|---|---|---|
| [`l10n`](skills/l10n/SKILL.md) | 소스 문자열 · 로케일 집합의 단일 출처 | `lib/l10n-scan.mjs` |
| [`storelisting`](skills/storelisting/SKILL.md) | **게이트 + 조언자** | `lib/store-l10n-check.mjs` · `lib/aso-advisor.mjs` |
| [`typeface`](skills/typeface/SKILL.md) | 폰트 · 스크립트 커버리지 · 두부 · RTL | `lib/font-check.mjs` |

에이전트는 [`l10n-engineer`](agents/l10n-engineer.md) 하나다. 구현 절차는 `nereus:build` 것을 쓴다.

## 로케일 집합 — 86 은 실측이다

`locales.json` 이 단일 출처다. Google Play 등재 지원 **86종**을 갖는다.

**출처 페이지의 목록 블록을 직접 파싱해 셌다** — 행 86 · 고유 코드 86 · 중복 0 · 파싱 실패 0.
같은 페이지에 요약 질의를 세 번 던졌을 때 **110 · 86 · 176** 으로 갈렸다.
**요약 모델은 세는 데 못 믿는다.** 그래서 `source` · `checkedAt` 과 함께 `howCounted` 를 남긴다.

두 집합이 한 파일에 있다. 스토어 로케일(`ko-KR`)과 소스 언어 별칭(`ko`)은 **다른 집합**이라
뭉치면 한쪽이 반드시 깨진다. 별칭은 `stores: []` 이고 가리키는 로케일과 수치가 같다
(테스트가 강제한다) — **편의지 두 번째 출처가 아니다.**

86종의 확장률을 실측 없이 지어낼 수 없으므로 **값마다 근거가 붙는다**:
`legacy-estimate` · `group-estimate` · `measured`.

## 게이트와 조언자가 나뉘어 있다

`Ruling: 게이트와 조언자는 파일을 나눈다.`

| | `store-l10n-check.mjs` | `aso-advisor.mjs` |
|---|---|---|
| 낸다 | `violations` · `coverage` · `skipped` · `unmeasured` | `levers` · `unanswerable` |
| 통과·차단을 판정하나 | **한다** | 하지 않는다 |

"잘린 채 발행됨"과 "브라질을 먼저 채우면 좋겠음"이 같은 무게로 나오면 진짜가 묻힌다.

```bash
echo '{"store":"play","declaredLocales":[…],"listings":{…}}' | node "${CLAUDE_PLUGIN_ROOT}/lib/store-l10n-check.mjs"
echo '{"coverage":{…},"signals":{"share":{…}}}'              | node "${CLAUDE_PLUGIN_ROOT}/lib/aso-advisor.mjs"
echo '{"requiredEmbedding":"game","fonts":[…]}'              | node "${CLAUDE_PLUGIN_ROOT}/lib/font-check.mjs"
```

## 세 가지 설계 판단

### 미달은 위반이 아니다

요구 집합 대비 진행 상태는 `coverage`, 위반은 **선언과 실제가 어긋난 것**뿐이다.
미달을 위반으로 내면 운영 중인 제품 전부가 즉시 빨개지고, **그러면 사람이 게이트를 끈다.**
(ToonTone 에서 하드코딩 검사가 461건을 내고 그중 진짜가 0건이었다.)

### 두부는 하네스가 파싱해도 못 막는다

사고는 "폰트에 글리프가 없다"가 아니라 **"렌더러가 `.notdef` 를 그리고 `exit 0` 했다"** 였다.
실제 렌더러가 고른 얼굴은 하네스가 모른다. 검증은 **렌더 직후 그 자리에서** 해야 의미가 있으므로
**증거를 요구한다.** 증거가 없으면 `tofu-unverified` — 미설정을 통과로 읽지 않는다.

### 번역 여부는 하네스가 정하지 않는다

앱 이름은 검색 키워드라 번역하면 유입이 끊기고, 설명문은 번역하지 않으면 전환이 깎인다.
**필드마다 답이 다르고 그건 사업 판단이다.** 강제하는 것은 **판단이 이유와 함께 기록에
남는 것**뿐이다 — 선언이 없으면 "판단해서 안 한 것"과 "빠뜨린 것"이 구분되지 않는다.

## 경계 — 여기서 하지 않는 것

- **번역 실행**(기계번역·발주). 번역하면 깨질 곳을 **먼저 찾는 것**이 일이다.
- **스토어 API 업로드·발행.** 하네스는 판정만 한다.
- **대사·자막 분기 설계**는 `nereus-game:narrative` 가 한다.
- **게임 임베딩 라이선스 요구와 장르 폰트 예산**은 `nereus-game:localization` 이
  값으로 주입한다(`requiredEmbedding` · `typography`).
- **App Store·웹 hreflang.** `stores` 에 자리만 있다 — 로케일 코드 형식과 길이 제한이 달라
  한 벌로 뭉치면 반드시 갈린다.
- **폰트 파일 파싱.** 새 런타임 의존성을 추가하지 않는다.

## 다른 플러그인과의 관계

**이 플러그인은 다른 플러그인이나 코어의 내부 모듈을 import 하지 않는다.**
`lib/cli-input.mjs` 도 이 플러그인의 것이다. 플러그인이 서로의 내부에 붙으면
설치 조합에 따라 조용히 깨진다.

`nereus-game` 은 이 플러그인을 **동반(companion)으로 선언**하고, **검사기를 직접 부르지 않는다.**

스킬·에이전트 이름은 다른 세 플러그인과 겹치지 않는다(`localization` 이 아니라 `l10n` 인 이유다).
겹치면 한쪽이 다른 쪽을 가린다. `/nereus:doctor` 가 검사한다.
