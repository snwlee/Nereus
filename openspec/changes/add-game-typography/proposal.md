# add-game-typography

## Why

`plugins/nereus-game` 전체에서 폰트 관련 언급은 `gameux` 의 "타이포 위계" 한 마디다.
게임에서 폰트는 미감 문제가 아니라 **라이선스·용량·가독성 문제**다.

그리고 이 감사에서 기존 l10n 의 결함이 드러났다. `l10n-scan.mjs` 의 `overflow` 는
폭을 **문자 수 × 언어 확장률**로 계산한다. 실제 폭은 폰트 메트릭이다.
근사인데 **근사라고 표시하지 않아** 틀린 확신을 준다.

지금 구조에서 다음이 전부 통과한다:
- 게임 임베딩이 금지된 폰트를 넣어도 아무도 안 막는다
- 한국어 UI 에 한글 글리프가 없는 폰트를 지정해도 통과한다 (게임에 두부가 나온다)
- 닉네임·채팅이 있는데 폰트를 서브셋해도 통과한다 (유저 이름이 깨진다)
- 모바일에 수 MB 폰트를 넣어도 예산 검사가 없다

## What Changes

- `lib/font-check.mjs` — 결정론적 폰트 검사기.
  라이선스 임베딩 허용, 로케일별 글리프 커버리지, 유저 생성 텍스트가 있을 때의 서브셋 금지,
  파일 크기 예산, 가독성 최소 크기·외곽선을 판정한다.
- `locales.json` 의 각 로케일에 `script` 와 `avgCharWidth` 를 **선택 키로** 추가한다.
  JA·ZH·KO 는 폰트 자체가 달라야 하므로 어떤 스크립트를 요구하는지 데이터로 둔다.
- `scanL10n` 에 `fonts` **선택 인자**를 더한다. 주면 폰트 메트릭으로 폭을 판정하고,
  안 주면 지금처럼 확장률로 판정하되 결과에 **`approx: true` 를 표시한다**.
  기존 반환 형태는 그대로다 — 새 키만 는다.
- `skills/localization/SKILL.md` 에 폰트 절, `skills/asset/SKILL.md` 에 폰트 라이선스 경유 규칙,
  `skills/gameux/SKILL.md` 에 가독성 포인터를 넣는다.

**새 스킬을 만들지 않는다.** 폰트의 네 축이 이미 있는 도메인에 각각 걸치고,
스킬을 하나 더 만들면 `nereus-game` 이 13개가 되어 플러그인 내부 라우팅 경쟁이 생긴다.

## Impact

- 영향 스펙: `game-harness` (요구사항 2개 추가)
- 영향 코드: `plugins/nereus-game/lib/{font-check,l10n-scan}.mjs`, `locales.json`,
  `skills/{localization,asset,gameux}/SKILL.md`
- **코어 `plugins/nereus` 는 바뀌지 않는다.**
