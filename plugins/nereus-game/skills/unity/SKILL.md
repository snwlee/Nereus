---
name: unity
description: Unity 개발 절차 — 2D 폰게임 중심. 헤드리스 테스트, 해상도·터치·발열 대응, AltTester 금지 근거. 트리거 "유니티", "Unity", "폰 게임", "모바일 게임".
---

# unity

nereus:common 규칙을 따른다. 워크플로는 **nereus 코어가 소유한다** — 이 스킬은 Unity 고유 절차만 담는다.
도메인 판단(레벨·스토리·UI/UX·에셋·밸런싱)은 도메인 스킬이 하고, 여기서 되풀이하지 않는다.

## 1. 프로젝트 전제

`ProjectSettings/ProjectVersion.txt` 가 있어야 Unity 스택으로 인식된다.
테스트 러너는 `lib/unity-stack.mjs` 의 `detectUnityRunner` 가 판정한다 —
`Packages/manifest.json` 의 `dependencies` 에 `com.unity.test-framework` 가 **실제로 들어 있어야** 한다.

코어의 확장 선언은 파일 존재만 보지만 `detectUnityRunner` 는 매니페스트 내용까지 읽는다.
프레임워크 없이 러너를 돌려주면 TDD 게이트가 매번 실패하고, 그러면 게이트를 꺼버리게 되기 때문이다.

## 2. 테스트는 헤드리스로 돈다

```
Unity -runTests -batchmode -nographics -quit
```

- EditMode 는 빠르다. 순수 로직은 전부 여기로 민다.
- PlayMode 는 느리다. 씬·물리·코루틴이 실제로 필요한 것만 남긴다.
- **로직을 MonoBehaviour 에서 떼어내는 설계가 곧 EditMode 커버리지다.** 이걸 spec 단계에서 태스크로 쪼갠다.
- CI 에서는 라이선스 활성화가 선행되어야 한다. 이것이 Unity CI 의 가장 흔한 실패 지점이다.
- **TDD 게이트가 안 켜지면 `Packages/manifest.json` 부터 본다.** 매니페스트가 깨져 파싱에 실패해도
  "테스트 프레임워크 없음"과 똑같이 러너가 `null` 이 되어 게이트가 조용히 꺼진다. 둘은 구분되지 않는다.

## 3. 2D 폰게임에서 봐야 하는 것

| 축 | 기준 |
|---|---|
| 해상도 | 종횡비 범위를 먼저 정한다(18:9 ~ 4:3). 안전영역 밖에 정보를 두지 않는다 |
| 터치 | 최소 타겟 44dp. 손가락이 누른 지점을 가린다는 것을 전제로 피드백 위치를 잡는다 |
| 발열·배터리 | 프레임 상한을 건다. 60 을 항상 쓰는 것보다 30 고정이 나은 구간이 있다 |
| 파편화 | 최저 사양 기기를 먼저 정하고 거기서 측정한다. 최신 기기에서만 재면 출시 후에 안다 |
| 빌드 크기 | 텍스처 압축 포맷을 플랫폼별로 지정한다. 기본값이면 크기가 몇 배가 된다 |

스프라이트 아틀라스를 쓴다. 드로우콜은 2D 에서 가장 흔한 성능 문제다.

## 4. Unity 공식 플러그인에 위임한다

Unity 가 낸 first-party 플러그인이 있다 — `unity@unity-agent-plugin`.
스킬 29개 + Unity CLI + Unity MCP 서버(에디터 실시간 제어). Unity 팀이 직접 쓰고 보안 검토하며
**엔진 업데이트와 함께 갱신한다.** 그래서 엔진 API 절차는 우리가 들고 있지 않는다 —
들고 있으면 엔진이 바뀔 때마다 낡고, 낡은 절차는 틀린 절차다.
`policy.json` 을 출처·확인일과 함께 데이터로 둔 것과 같은 이유다:
**남이 정하고 남이 바꾸는 값은 우리가 복사해두지 않는다.**

먼저 판정한다. 설치돼 있지 않은데 위임을 지시하면 없는 스킬을 부른다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/unity-stack.mjs"
```

`detectUnityAgentPlugin` 이 설치 인벤토리와 활성 설정을 읽어 판정한다.
디스크에 파일이 있느냐가 아니라 **설정의 활성 상태**가 진실이다.

| `status` | 뜻 | 할 것 |
|---|---|---|
| `ready` | 설치·활성 | 아래 표대로 위임한다 |
| `disabled` | 설치됐으나 설정에서 꺼짐 | 사용자에게 알리고 **우리 절차로 진행한다**. 남의 설정을 켜지 않는다 |
| `absent` | 미설치 | 우리 절차로 진행한다. 설치 명령만 안내한다 |
| `unknown` | 인벤토리를 못 읽음 | **미설치로 단정하지 않는다.** 사유를 그대로 알리고 사용자에게 확인받는다 |

`absent` · `disabled` 면 설치·활성 명령을 안내한다. 직접 실행하지 않는다 — 사용자 승인 뒤다.
명령은 `/nereus:setup` 의 **동반 플러그인 표**가 상태에 맞게 낸다 — 이 확장의
`nereus-extension.json` 선언에서 유도된다. 여기서 명령을 따로 적지 않는다:
두 군데에 적으면 한쪽만 낡는다.

**Unity 버전을 올렸으면 플러그인도 올린다.** 스킬이 엔진 업데이트와 함께 갱신되는 것이
위임하는 이유인데, 안 받으면 그 이유가 사라진다. 같은 표가 설치된 상태에서는
업데이트 명령을 낸다(마켓 갱신 → plugin update → **재시작**).

`advice` 에 `scope-user` 가 있으면 알린다 — 전역 설치라 Unity 가 아닌 저장소에서도
스킬 29개가 상시 로딩된다. 토큰 예산 손해다. Unity 저장소에서만 켜는 쪽을 권한다:

```
/plugin marketplace add Unity-Technologies/unity-agent-plugin
claude plugin install unity@unity-agent-plugin --scope project
```

### 4.1 위임하는 것 — 엔진 API 절차

| 우리 도메인 | 넘길 Unity 스킬 |
|---|---|
| gameux (UI·HUD) | `ui` · `ui-uitk` · `ui-ugui` · `ui-imgui` · `optimize-text-mesh-pro` |
| asset (2D·스프라이트) | `sprite-editor` · `manage-sprite-atlas` · `2d-pixel-perfect` |
| level (타일맵·내비) | `tilemap-palette-create` · `tilemap-ruletile-*` · `initialize-ai-navigation` |
| sound | `audio-setup-mixers` · `optimize-audio` |
| impact (연출) | `urp-postprocessing` · `shader-graph-create-custom-node` |
| localization | `localization` (CJK 폰트 포함) |
| liveops | `build-live-game` |
| compliance (배선만) | `implement-in-app-purchases` · `levelplay-unity-integration` |
| 빌드·패키지 | `unity-cli` · `unity-package-management` · `optimize-web` |

**도메인 판정은 여전히 우리 것이다.** 넘기는 것은 "Unity 에서 이걸 어떻게 하느냐"이지
"무엇을 해야 하느냐"가 아니다. 예: 확률 공개 판정은 `compliance` 가 하고,
통과한 계획을 Unity IAP 로 배선하는 일만 넘긴다.

### 4.2 위임하지 않는 것 — 게이트 전부

- **TDD 게이트** — 테스트 먼저. 러너 판정은 `detectUnityRunner` 가 계속 한다
- **design 게이트** — 화면·미감은 Gemini 피드백을 거친다
- **review** · **security** — 2차 의견과 심각도 판정
- **compliance 판정** — 규정은 엔진이 아니라 플랫폼과 법령이 정한다
- **track 추천** · **finish** — 사업 판단과 완료 게이트

게이트까지 넘기면 하네스에 남는 게 없다. **위임 경계는 "남이 바꾸는 값이냐"로 긋는다.**

### 4.3 기대치를 부풀리지 않는다

Unity 문서가 스스로 적은 한계다 — 단순 uGUI 작업은 개선 폭이 작고,
Sonnet 5 에서는 주로 **정확성**을 보탤 뿐 기능 대부분은 플러그인 없이도 만든다.
도입 근거는 "빨라진다"가 아니라 **"API 오답과 버전 드리프트가 줄어든다"** 이다.
플러그인이 있다고 우리 게이트를 얇게 하지 않는다.

## 5. 하지 말 것

- **AltTester 를 도입하지 않는다.** GPL-3.0 이고 SDK 를 게임 빌드에 심는 구조라
  상용 게임에 라이선스가 전염될 위험이 실재한다. 비GPL UPM 경로를 확보하기 전에는 쓰지 않는다.
  그때까지 E2E 는 PlayMode 테스트 범위로 한정한다.
- 로직을 MonoBehaviour 에 묻지 않는다. 묻는 만큼 EditMode 로 못 옮긴다.
- 최신 기기에서만 성능을 측정하지 않는다.
