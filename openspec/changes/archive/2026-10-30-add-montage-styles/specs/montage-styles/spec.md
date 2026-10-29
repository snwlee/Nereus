# montage-styles Specification

## Purpose
영상 제작 전에 스타일을 고른다. 후보는 Lemo-Opuscar 스타일 카탈로그에서 결정적으로 뽑고, 고른 스타일의 STYLE.md 를 장면 지시로 옮긴다.
영상 스타일 동반 도구는 라이선스·상표·유료 키로 판정해 광고에 쓸 수 없는 것을 막는다.

## ADDED Requirements

### Requirement: style.json 은 카탈로그 항목으로 정규화되어야 한다
<!-- id: montage-styles.catalog -->
<!-- entities: StyleCatalog -->
<!-- enforced: tests/skills/montage-styles-catalog.test.ts -->

The system MUST satisfy the following. `normalizeStyle(json)` 는 `{ slug, name, category, uses, film, line, dur }` 를 내고
(`name`=`en`, `category`=`category_en`, `uses` 는 문자열 배열, 없으면 `[]`), `slug` 가 `^[a-z0-9-]+$` 가 아니거나 `_` 로 시작하면 `null` 이어야 한다.

#### Scenario: 정규화
- **WHEN** art-deco 의 style.json
- **THEN** `{ slug: "art-deco", name: "Art Deco", category: "Graphic & Type", uses: ["Luxury & hospitality","Galas","Invitations"], … }`

#### Scenario: 템플릿 제외
- **WHEN** `slug` 가 `_template`
- **THEN** `null`

### Requirement: 후보는 브리프와의 겹침 점수로 결정적으로 골라야 한다
<!-- id: montage-styles.pick -->
<!-- entities: StyleCatalog -->
<!-- enforced: tests/skills/montage-styles-catalog.test.ts -->

The system MUST satisfy the following. `pickStyles(catalog, brief, { commercial, n })` 는 브리프와 각 스타일의
`uses`·`name`·`category`·`line` 을 소문자 토큰(2자 이상, 영문·숫자·한글 외 문자로 분리, 4자 이상 토큰의 끝 `s` 제거)으로 바꿔 겹치는 토큰 수를 점수로 하고,
점수 내림차순·slug 오름차순으로 정렬해 점수 0 초과인 것만 최대 `n`(기본 5)개 낸다. 각 결과는 `{ ...style, score, matched }` 다.
`BLOCKED_STYLES` 의 slug 는 `commercial` 이면 결과에서 빠지고, 아니면 남되 `warning` 을 단다. 같은 입력은 항상 같은 출력이다.

#### Scenario: 용도 매칭
- **WHEN** 브리프 "luxury hotel gala invitation", art-deco 와 ascii-crt
- **THEN** 첫 결과가 art-deco 이고 `matched` 가 `["gala", "hotel", "invitation", "luxury"]`

#### Scenario: 광고면 차단 스타일 제외
- **WHEN** `commercial: true`, 브리프가 living-screencast 와 겹친다
- **THEN** 결과에 living-screencast 가 없다

#### Scenario: 비상업이면 경고
- **WHEN** `commercial: false`, 같은 브리프
- **THEN** living-screencast 가 있고 `warning` 에 `Clawd` 가 있다

### Requirement: 동반 도구는 라이선스·상표·키로 판정해야 한다
<!-- id: montage-styles.companion -->
<!-- entities: Companion -->
<!-- enforced: tests/skills/montage-styles-companions.test.ts -->

The system MUST satisfy the following. `companionVerdict(name, { commercial, named, paidKey })` 는 `{ verdict, reason }` 를 내며
`lemo-opuscar` 는 `allow`; `collage-broll` 은 `paidKey` 없으면 `block`, 있으면 `conditional`(video-gate·budget);
`claude-animation-base` 는 `commercial` 이면 `block`, 아니면 `conditional`; `onetake` 는 `commercial` 이면 `block`,
비상업이고 `named` 면 `conditional`, 아니면 `block`; 그 밖은 `block` 이어야 한다. 이름은 대소문자·공백·밑줄을 `-` 로 정규화한다.

#### Scenario: onetake 광고 차단
- **WHEN** `companionVerdict("onetake", { commercial: true, named: true })`
- **THEN** `verdict` 가 `block`, `reason` 에 `PolyForm`

#### Scenario: Collage 키 없음
- **WHEN** `companionVerdict("Collage B-roll", {})`
- **THEN** `block`

### Requirement: 영상 스타일 요청은 montage 로 라우팅되어야 한다
<!-- id: montage-styles.route -->
<!-- entities: Router -->
<!-- enforced: tests/lib/router.test.ts -->

The system MUST satisfy the following. "영상 스타일", "영상 룩", "lemo", "opuscar" 를 담은 요청은 `nereus:montage` 로 라우팅되어야 한다.

#### Scenario: 스타일 요청
- **WHEN** "이 광고 영상 스타일 골라줘"
- **THEN** 라우트에 `nereus:montage` 가 있다
