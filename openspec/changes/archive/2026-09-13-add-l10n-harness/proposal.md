# add-l10n-harness

## Why

현지화 검사는 지금 **소스 코드 문자열까지만** 본다. 그런데 제품이 사용자에게 닿는 표면은 셋이다:

| 표면 | 지금 | 누가 보나 |
|---|---|---|
| 소스 코드 문자열 | 검사한다 | `nereus-game:localization` |
| **스토어 등재 텍스트**(제목·설명·패치노트) | **아무도 안 본다** | — |
| **스토어 이미지 안의 텍스트** | **아무도 안 본다** | — |

그리고 더 중요한 것: **무엇을 번역하지 *않을* 것인가**가 아무 데도 기록되지 않는다.
앱 이름은 검색 키워드라 번역하면 유입이 끊긴다. 설명문은 번역하지 않으면 전환이 깎인다.
**필드마다 답이 다른데**, 지금은 "판단해서 안 한 것"과 "그냥 빠뜨린 것"이 구분되지 않는다.

## 도너 — 이미 대가를 치른 지식

`~/workspace/claude-skills/wallpaper-deploy` 가 **19 로케일**을 실제로 운영한다(읽기 전용).
`references/play-release.md` 에 판정이 이미 적혀 있다:

> `app title  one identical string in all 19 — left that way on purpose:`
> `"ENHYPEN Wallpapers" is the search keyword, and translating it costs discovery`

그리고 **진짜 비용은 번역이 아니라 폰트**라는 것도:

- Oswald/Rubik/Didot 은 한국어·일본어·태국어를 **빈 네모로 그린다**.
- **PIL 은 빠진 글리프를 `.notdef` 로 그리고 exit 0 한다** — 로케일 하나가 통째로
  두부로 나가는데 **성공으로 보인다**.
- RTL 두 톤 타이틀이 문자열을 쪼개면 셰이퍼가 공백을 잃고 순서를 뒤집는다.
- 아랍 우선 폰트에는 **라틴 숫자가 없어** "4K" 가 아랍어 옆에서 두부가 됐다.

19 에서 이미 이랬다.

## 왜 새 플러그인인가

**게임 고유분이 거의 없다.** 측정했다(2026-09-13):

| 파일 | 줄 | 게임 고유 토큰 |
|---|---|---|
| `plugins/nereus-game/lib/l10n-scan.mjs` | 99 | **0건** |
| `plugins/nereus-game/lib/font-check.mjs` | 81 | **2곳** — `embedding "game"`, `genre` 프로파일 |

`localization` 스킬에 자막·대사·더빙 언급은 **0건**이다 — 대사 현지화 대비는
`nereus-game:narrative` §4 가 이미 갖는다. **지금 위치가 이미 틀렸다.**
프로덕션인 WallpaperEngine 은 게임이 아니라 `nereus-game` 을 깔 이유가 없고,
깔지 않으면 현지화 검사가 통째로 없다.

집을 `nereus-store` 로 잡지 않는 이유: **스토어 등재는 현지화의 한 표면이지 그 반대가 아니다.**
`store` 로 잡으면 소스 l10n 검사기가 들어갈 자리가 없어 `nereus-game` 에 남고, 그러면
플러그인 간 import 금지 Ruling 때문에 **로케일 집합이 두 벌이 된다. 두 벌이면 반드시 갈린다.**

## 로케일 집합 — 86 은 실측이다

오너 확정: "최소 로케일은 구글플레이에서 지원하는 언어 종류만큼".

출처 페이지를 받아 목록 블록을 **직접 파싱해 셌다**: 행 86 · 고유 코드 86 · 중복 0 · 파싱 실패 0.
같은 페이지에 요약 질의를 세 번 던졌을 때 **110 · 86 · 176** 이 나왔다 —
**요약 모델은 세는 데 못 믿는다.** 데이터에 출처 URL·확인일과 함께 **파싱 방법**을 남긴다.

현재 프로덕션은 19 다. 86 은 4.5배이고, 86×5 스크린샷 = 앱당 430장 × 플레이버 16개다.

## 무엇을 만드나

### 게이트 — `store-l10n-check.mjs`

| 위반 | 왜 조용한가 |
|---|---|
| `untranslated-undeclared` | 전 로케일이 같은 문자열인데 **왜인지 선언이 없다**. 판단과 누락이 구분되지 않는다 |
| `declared-but-empty` | 로케일을 선언해 놓고 필드를 비웠다. Play 가 조용히 기본 로케일로 fallback 한다 |
| `field-length-overflow` | Play 필드 길이 제한 초과. 잘린 채 발행된다 |
| `locale-code-unknown` | `ko` 를 Play 에 넣으면 `ko-KR` 이 아니다. 그 로케일은 그냥 안 생긴다 |
| `tofu-unverified` | 글리프 검증 증거가 없다. **PIL 은 두부를 그리고 exit 0 한다** |
| `rtl-split-run` | RTL 인데 타이틀을 쪼개 그린다. 공백이 사라지고 순서가 뒤집힌다 |

### 조언자 — `aso-advisor.mjs`

`{ coverage, levers, unanswerable }`. **게이트가 아니다** — 어느 로케일을 먼저 채울지는
**사업 판단**이다. 매출 점유율 같은 실측치는 하네스에 넣지 않고 **입력으로 받는다**.

## 무엇을 옮기나

`l10n-scan.mjs` · `font-check.mjs` · `locales.json` 을 `nereus-l10n` 으로 이관한다.
`nereus-game:localization` 에는 게임 고유 2건만 남고, 검사기에 **데이터로 주입**한다
(`requiredEmbedding: "game"` · 장르 폰트 예산). 형제 플러그인을 호출하지 않고
`companions` 로 건다 — 설치 조합에 따라 조용히 깨지면 안 된다.

## 범위 밖

- 번역 실행(기계번역·발주). 번역하면 깨질 곳을 **먼저 찾는 것**이 일이다.
- 스토어 API 업로드·발행. `wallpaper-deploy` 가 이미 한다.
- App Store·웹 hreflang. **스토어별 표로 두되 이번엔 Play 만 채운다.**
- 폰트 파일 파싱. 새 런타임 의존성을 추가하지 않는다 — 대신 **검증 증거를 요구**한다.
