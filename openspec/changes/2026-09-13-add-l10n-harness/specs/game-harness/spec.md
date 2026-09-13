## REMOVED Requirements

### Requirement: 현지화 위험을 번역 전에 판정해야 한다
<!-- id: l10n.scan -->

**이유**: `nereus-l10n` 으로 이관한다. `l10n-scan.mjs` 99줄에 게임 고유 토큰이 **0건**이었다
(2026-09-13 측정). 프로덕션인 WallpaperEngine 은 게임이 아니라 `nereus-game` 을 깔 이유가 없고,
깔지 않으면 현지화 검사가 통째로 없다. 같은 요구사항이 `l10n-harness` 기준선에 그대로 선다.

### Requirement: 현지화 검사는 생성물과 개발자 메시지를 위반으로 보고하지 않아야 한다
<!-- id: l10n.excludeNonUserFacing -->

**이유**: 위와 같다. ToonTone 461:0 사건의 결론이므로 **문구를 그대로** 옮긴다.

### Requirement: 제외 규칙은 데이터로 덮어쓸 수 있어야 한다
<!-- id: l10n.excludeIsData -->

**이유**: 위와 같다.

### Requirement: 폰트를 라이선스·글리프·용량·가독성으로 판정해야 한다
<!-- id: font.check -->

**이유**: `nereus-l10n` 으로 이관한다. 게임 고유는 `embedding "game"` 하드코딩과 장르 예산
**두 곳뿐**이었다. 임베딩은 `requiredEmbedding` 입력으로 일반화하고(→ `typeface.embedding`),
장르 예산은 `nereus-game` 이 값으로 주입한다.

### Requirement: 문자열 폭 판정은 근사 여부를 표시해야 한다
<!-- id: l10n.approxWidth -->

**이유**: 위와 같다. `approx: true` 불변식은 `l10n-harness` 에서 유지된다.
