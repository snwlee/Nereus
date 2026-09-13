# nereus-game

게임 개발 하네스. `nereus` 코어의 워크플로(intake → spec → build → review → finish) 위에서
**게임 도메인과 엔진 어댑터만** 담당한다. 워크플로 스킬을 복제하지 않는다.

## 왜 별도 플러그인인가

- 코어 라우터는 한 프롬프트당 스킬 2개(`MAX_HITS`)만 지목한다. 게임 라우트를 코어에 섞으면
  웹·앱 작업 프롬프트에서 자리를 뺏는다.
- 완료의 정의가 다르다. 코어의 finish 는 커밋·아카이브, 게임은 롤아웃·지표 관측이다.

## 붙는 방식

`nereus-extension.json` 이라는 **순수 데이터 파일**로 코어 확장점에 붙는다. 코어는 이 파일을
읽기만 하고 코드를 `import()` 하지 않는다 — 형제 플러그인의 런타임 오류가 코어 훅을 죽이면 안 된다.

```json
{
  "routes": [{ "skill": "nereus-game:roblox", "why": "…", "re": "roblox|rojo|luau" }],
  "stacks": [{ "name": "roblox", "marker": "default.project.json",
               "runnerMarker": "lune.yaml", "runner": "lune", "command": "lune run tests",
               "sourceExt": [".luau", ".lua"], "testRe": ["\\.spec\\.luau$", "(^|/)[Tt]ests?/"] }]
}
```

코어 라우트·스택이 항상 앞이고, 코어가 러너를 찾으면 확장 러너는 무시된다.

### `sourceExt` · `testRe` 는 선택이 아니다

코어는 게임 언어의 확장자를 모른다. **러너만 선언하고 `sourceExt` 를 빼면 TDD 게이트가
"소스 파일이 아님"으로 빠져 경고도 차단도 한 번도 발동하지 않는다.** 초판이 정확히 그 상태였고,
단위 테스트는 전부 초록이었다 — 실제 로블록스 프로젝트에 물려 보고서야 드러났다(2026-09-12).
`tests/smoke/extension-wiring.test.ts` 가 이제 "러너를 선언한 스택은 `sourceExt` 도 선언한다"를 강제한다.

규칙은 **이 프로젝트에 marker 가 실제로 있는 스택으로 좁혀서** 적용된다. 좁히지 않으면
설치만 해 둔 다른 스택의 테스트 패턴까지 인정돼 동명 타 언어 테스트가 게이트를 통과시킨다.

## 지원 스택

| 스택 | 상태 | 테스트 게이트 |
|---|---|---|
| 로블록스 (Rojo + Luau) | **동작** | 1단 `lune` 로컬 · 2단 Open Cloud Luau Execution(finish) |
| Unity (2D 폰) | **동작** | Unity Test Framework (`-batchmode -nographics`) |
| Nintendo Switch | **경계·절차 동작** (실기기 검증은 승인 필요) | 빌드 명령은 설정에서 읽음 |

## 스택 어댑터 — Flutter

코어 `plugins/nereus/hooks/scripts/lib/stack.mjs` 가 이미 `pubspec.yaml` → flutter,
`flutter_test` → `flutter test` 를 판정한다. **`stacks` 에 flutter 를 다시 선언하지 않는다** —
같은 것을 두 곳이 정하면 어긋날 때 어느 쪽이 진실인지 알 수 없다.

`lib/flutter-stack.mjs` 의 `detectFlutterGame` 은 그 위에 **게임에 필요한 사실**을 얹는다.
한 번 돌리면 다른 검사기의 입력이 전부 나온다:

```
detectFlutterGame(root) → { runner, flame, flavors, layers, notes }
                                        ↓        ↓
                               parity-check   purity-check
```

- 플레이버는 `android/app/src/<flavor>/` 에서 읽는다. Gradle 이 그 디렉터리를 스캔해
  productFlavor 를 **동적 생성**하는 구조에서는 `build.gradle` 에 이름이 하나도 없다.
- **`flavors: null` 은 "없다"가 아니라 "못 찾았다"** 이고 이유가 `notes` 에 실린다.
- Flame 은 **없어도 결함이 아니다.** 위젯으로 충분한 장르는 순수 Flutter 가 맞는 선택이다.
  Flame 유무가 계층 경계를 바꾸지 않는다 — 순수 층은 어느 쪽에서도 같다.

> 검증(2026-09-13): ToonTone 에 돌려 플레이버 8종·러너·경계 3종이 자동으로 나왔고,
> **손으로 만든 입력 없이** purity(위반 0) · parity(applicable true, 위반 0)까지 이어졌다.
> 앞 두 사이클에서 손으로 만들던 입력이 그것과 같은 값이었다.

## 원격 설정 분류 (liveops)

원격 설정은 라이브옵스에서 **가장 위험한 코드**다 — 원격으로 바뀌고, 관찰이 어렵고,
틀리면 몇 주 동안 아무도 모른다. `lib/remote-config-check.mjs` 가 네 가지를 본다.

> **★ 번들 기본값이 있는 키는 원격에 값이 없어도 "설정됨"으로 판정된다.**
> 그래서 그 아래 폴백 계층(등급 표 · 플레이버 설정 · 정책 상수)이 **조용히 죽는다.**
> 에러도 로그도 없다. 실제로 이 사고로 접이식 배너가 전 등급 영구 OFF 가 된 이력이 있다.

`bundle-unsafe` 만 `severity: "incident"` 다 — **실제로 사고를 낸 항목**이기 때문이다.
나머지(`unclassified` · `phantom` · `multi-class` · `key-pattern`)는 `trust`,
즉 분류를 믿을 수 있게 만드는 전제 조건이다. 같은 무게로 보고하면 진짜가 묻힌다.

분류 체계는 `remote-config.json` 데이터다. 이름은 제품마다 다르고
**보편적인 것은 이름이 아니라 구조** — 각 분류가 `bundleSafe` 와 `why` 를 갖는다.

검사기가 **못 보는 것도 적어둔다**: 값 해석("0 은 무제한이 아니다")과
등급·실험 혼용의 실제 사용처. 검사기가 다 본다고 믿게 만드는 것이 더 나쁘다.

> 검증(2026-09-13): ToonTone 의 실제 48키·5분류로 돌려 **위반 0**,
> 하위 계층 키(`ad_collapsible_banner_enabled`)를 번들에 주입해 **사고를 그대로 재현**했다.

## 제작 층 (craft)

**게임 자체를 만드는 층.** 스택 스킬들이 "로직을 엔진에서 떼어내는 설계가 곧 1단 커버리지"라고
적어놓고 **어떻게 떼는지를 비워두었다.** 그 자리를 채운다.
담당 에이전트는 `gameplay-engineer` — 다른 에이전트 5종은 전부 문서·데이터를 내고,
여기만 코드의 판단을 한다. TDD 절차·게이트는 `nereus:build` 것을 그대로 쓴다.

| 축 | 내용 |
|---|---|
| 코어 루프 | 본다 → 결정한다 → 돌아온다 → 남는다. 네 칸이 안 차면 게임이 아니라 기능 목록이다 |
| 계층 경계 | 순수 / 바인딩 / 표현. 판정 질문은 "엔진을 켜지 않고 단언할 수 있는가" |
| 수직 슬라이스 | 루프 한 바퀴가 끝까지 도는 가장 얇은 경로. 저장·설정·최종 에셋은 뺀다 |
| 서버 권위 | 조작되면 **다른 플레이어의** 경험이 나빠지는 값만 서버가 정한다 |

검사기 둘이 이것을 집행한다:

- `lib/purity-check.mjs` — 계층 경계. 엔진별 금지 문자열은 `layers.json` **데이터**다.
  선언에 `why` 가 없으면 던지고, 위반 보고에도 `why` 가 실려 나온다 —
  "무엇을 어겼다"만 오면 읽는 사람은 경계를 지우는 쪽을 택한다.
- `lib/parity-check.mjs` — 플레이버 패리티(다작 트랙의 코드 규율). 플레이버가 둘 미만이면
  위반 0 이 아니라 `applicable: false` 다. 깊게 트랙에는 플레이버라는 개념이 없다.

둘 다 줄 단위 문자열 판정이라 **근사**다(`approx: true`). 언어 파서를 넣으면
언어마다 파서가 필요해지고 엔진 불가지론이 깨진다.

> 검증(2026-09-13): 실제 Flutter 폰게임(ToonTone, Dart 137파일)에 돌려 **둘 다 위반 0**,
> 위반을 주입하면 잡는 것까지 확인했다. 그 과정에서 오탐 두 부류를 잡았다 —
> 순수 계층의 **문서 주석**("dart:ui 에 의존하지 않는다")과, 패리티의 **널·타입·변수 대 변수 비교**.

## 도메인 스킬 (엔진 무관)

`level` · `narrative` · `gameux` · `asset` · `balance` · `craft` — 전부 특정 엔진 문법을 담지 않는다.
메인 플랫폼이 없고 로블록스와 2D 폰게임을 동시에 대응해야 하므로, 도메인 지식이 엔진에 묶이면 두 벌이 된다.
테스트가 이것을 강제한다(`tests/smoke/game-domain.test.ts`).

## 장르 프로파일

장르는 코드 분기가 아니라 `profiles/*.json` 데이터다. 장르 추가 = 파일 한 장.

| 프로파일 | 루프 | 주 실패 양상 |
|---|---|---|
| `sim-tycoon` | 수집 → 판매 → 재투자 → 확장 | 병목 (다음 단계 도달 불가) |
| `obby-platformer` | 도전 → 실패 → 재시도 → 통과 | 난이도 절벽 |
| `battle-pvp` | 조우 → 교전 → 정산 → 재장비 | **지배 전략** (선택지 하나가 압도) |
| `narrative` | 도입 → 선택 → 전개 → 귀결 | 페이싱 (경제가 없을 수 있다) |

알 수 없는 장르는 **던진다.** 기본값으로 떨어지면 수치가 그럴듯한 채로 틀린다.

## 밸런싱 시뮬레이터

`lib/balance-sim.mjs` — 결정론적(seed 기반). 경제 정의를 N턴 돌려
`bottlenecks` · `inflation` · `cliffs` 를 수치로 낸다. 같은 입력이면 같은 출력이라 게이트로 쓸 수 있다.

## 2단 테스트 게이트 (로블록스)

finish 단계에서 `lib/roblox-gate.mjs` 의 `robloxStageTwo` 가 Open Cloud Luau Execution 으로
실제 Roblox 서버에서 통합 테스트를 시도한다. 환경변수 셋이 필요하다 —
`ROBLOX_API_KEY` · `ROBLOX_UNIVERSE_ID` · `ROBLOX_PLACE_ID`.

네 상태를 구분한다: `skipped`(로블록스 아님) · `unconfigured`(키 없음, **통과**) ·
`failed`(실제 실패, 차단) · `passed`. **키가 없다고 막지 않는다** — 막으면 키 없는 세션에서
finish 자체가 불가능해진다.

## 에셋 파이프라인 doctor

`lib/asset-doctor.mjs` 의 `assetDoctor()` 가 단계별 전제를 판정한다
(3d → `blender`, 2d → `COMFYUI_URL`, audio → `ELEVENLABS_API_KEY`).
설치를 시도하지 않고, 무엇이 없어서 어느 단계가 막히는지만 알린다. 부재는 결함이 아니라 상태다.

## 훅

`PostToolUse(Edit|Write|MultiEdit)` — `.luau`/`.lua` 편집 후 StyLua 포맷 + selene 린트.

- **로블록스 프로젝트에서만** 돈다(`default.project.json` 기준). `rokit` 셰임이 PATH 에 있어도
  프로젝트 밖에서는 실행하지 않는다.
- 도구가 **없으면** 조용히 건너뛴다(종료 코드 0). 도구가 **찾은 위반**은 stderr 경고로 올린다.

## NDA 경계

Switch 개발을 위해 **NDA 구역의 외부 전송만** 차단한다(PreToolUse `nda-guard`).
읽기·편집은 막지 않는다 — 막으면 개발 자체가 안 된다.

- 기본 구역: `Platform/Switch/**` · `**/NintendoSDK/**` · `**/*.nx.*`
- 차단 대상: 그 경로를 `codex`·`agy`·`ocr`·`curl`·`gh` 등에 넘기는 Bash 명령
- 기본값은 **차단**. 경고로 낮추는 것은 의식적 행위여야 한다
- Lotcheck 체크리스트 본문은 저장소에 없다(항목 자체가 NDA). `.nereus/lotcheck/` 에서 읽는다

## 외부 도구

`rojo` · `lune` · `stylua` · `selene` · `luau-lsp` (전부 선택. 없으면 해당 게이트만 꺼진다)
