---
name: adpolicy
description: 광고 정책 게이트 — 무효 트래픽(디버그/릴리스 광고 단위)·첫 세션 보호·동의 순서·타게팅 신호 일관성을 판정한다. 트리거 "광고 단위", "테스트 광고", "UMP", "동의", "무효 트래픽", "첫 세션 전면".
---

# adpolicy

nereus:common 규칙을 따른다. 담당 에이전트: ads-engineer.
**엔진·프레임워크와 무관하다** — Flutter 든 Unity 든 네이티브든 정지 사유는 같다.

광고는 **가장 위험하고 가장 조용한 코드**다. 정책을 어기면 계정이 정지되고,
정지는 그 앱 하나가 아니라 **계정에 달린 앱 전부**를 멈춘다. 그리고 어기는 순간에는
아무 에러도 나지 않는다 — 빌드는 초록이고 광고는 잘 보인다.

## 0. 이 스킬은 게이트다

| | 이 스킬(`adpolicy`) | `adrevenue` |
|---|---|---|
| 낸다 | `violations` | `levers` · `unanswerable` |
| 뜻 | 정지 위험. 고치지 않으면 안 된다 | 돈을 더 벌 여지. 사업 판단이다 |
| 검사기 | `lib/ad-policy-check.mjs` | `lib/ad-funnel.mjs` |

`Ruling: 게이트와 조언자는 파일을 나눈다` 의 적용이다. 한 곳에서 같이 내면
"정지 위험"이 "배너 단가 좀 낮음" 옆에 나란히 붙어 진짜가 묻힌다.

## 1. 원칙 — 안전 처방은 노출을 줄이지 않는다

`Ruling: 광고 안전 처방은 노출을 줄이지 않는 형태여야 한다.`

"전면 광고를 덜 띄우세요"는 지켜지지 않는다. 수익이 바로 떨어지는 것이 보이기 때문이다.
지켜지지 않는 게이트는 **꺼진다**. 그래서 이 스킬의 모든 처방은
**무엇을 언제 어떤 단위로** 바꿀 것인가이지, 몇 건을 포기할 것인가가 아니다.

첫 세션 보호만이 예외로 보이지만 그것도 아니다 — 첫 세션은 **어차피 수익이 안 난다**.
미루면 D1 리텐션이 오르고, 오른 리텐션이 둘째 세션부터 노출을 더 만든다. 양쪽으로 이득이다.

## 2. 상태를 JSON 으로 적는다

축은 전부 **선택**이다. 주지 않은 축은 **검사하지 않는다** —
모르는 것과 통과한 것을 같게 보고하면 검사되지 않은 것이 통과로 읽힌다.

```json
{
  "build":   { "debug": false },
  "units":   [{ "format": "interstitial", "platform": "android", "resolvedId": "ca-app-pub-…/…" }],
  "plan":    { "formats": ["interstitial", "rewarded"] },
  "session": { "launchCount": 0, "protectionEnabled": true },
  "consent": { "initBeforeConsent": false, "skippedForConsent": ["fixedBanner"], "retryRegistered": ["fixedBanner"] },
  "targeting": {
    "fixedBanner": { "keywords": ["wallpaper", "kpop"], "contentUrl": "https://example.com" },
    "rewarded":    { "keywords": ["wallpaper", "kpop"], "contentUrl": "https://example.com" }
  }
}
```

`units[].resolvedId` 는 **실제로 SDK 에 넘어가는 값**이다. 상수 선언이 아니라
플레이버·빌드 모드·원격 설정을 전부 통과한 뒤의 값을 적는다. 거기서 갈리기 때문에 검사한다.

## 3. 검사

```bash
echo '{"build":{"debug":true},"units":[…]}' | node "${CLAUDE_PLUGIN_ROOT}/lib/ad-policy-check.mjs"
```

| 위반 코드 | 뜻 | 왜 조용한가 |
|---|---|---|
| `prod-unit-in-debug` | 디버그 빌드가 프로덕션 단위에 트래픽을 만든다 | 무효 트래픽은 집계 뒤 정지로 온다. **되돌릴 수 없다** |
| `demo-unit-in-release` | 릴리스에 데모 단위가 남았다 | 광고는 정상으로 보이고 수익만 0 이다 |
| `first-session-interruptive` | 첫 세션에 중단형 포맷을 띄운다 | 리텐션 손실은 지표에만 나타난다 |
| `init-before-consent` | 동의 해석 전에 광고를 초기화했다 | 규정 위반이고 되돌릴 수 없다 |
| `consent-retry-missing` | 동의 대기로 건너뛴 로드를 재시도하지 않는다 | 그 세션 동안 그 포맷이 영원히 빈다 |
| `targeting-empty` | 타게팅 신호 없이 요청한다 | 낮은 매치율로만 나타난다 |
| `targeting-mismatch` | 포맷마다 신호가 다르다 | 갈린 쪽이 조용히 매치율을 잃는다 |

## 4. 판정 규칙 — 왜 이렇게 정했나

### 데모 단위는 표로만 판정한다

`ads-policy.json` 의 `demoUnits[platform][format]` 이 유일한 근거다. 코드에 ID 를 박지 않는다 —
구글이 정하고 구글이 바꾸는 값이다. `source` 와 `checkedAt` 이 같이 붙어 있다.

**플랫폼마다 데모 ID 가 다르다.** 안드로이드 데모 ID 를 iOS 빌드에 쓰면 그것은
그 플랫폼의 데모가 아니고, 무효 트래픽이 된다. 그래서 표를 2차원으로 둔다.

### 미설정은 보호다

`session.launchCount` 가 없으면 **첫 세션으로 본다**. 카운터가 아직 없는 상태가
정확히 진짜 첫 세션이기 때문이다. 한 세션 더 보호하는 비용이 진짜 첫 세션에
전면 광고를 띄우는 비용보다 압도적으로 싸다.

`Ruling: 미설정의 기본 방향은 보호다 — 미설정을 해제로 읽으면 조용히 최악으로 떨어진다.`

끄려면 `protectionEnabled: false` 를 **명시**해야 한다. 킬 스위치는 있어야 한다 —
없는 게이트는 우회되고, 우회는 기록이 안 남는다.

### 리워드는 보호 대상이 아니다

사용자가 스스로 고른 것을 막으면 보상 경로가 끊긴다. `interruptiveFormats` 에서 빠져 있고,
그 이유가 `interruptiveFormatsWhy` 로 데이터에 적혀 있다.
**경계 선언에 `why` 를 빼지 않는다 — 이유 없는 경계가 가장 먼저 지워진다.**

### 개인화 여부는 판정하지 않는다

UMP 동의와 SDK(TCF 문자열)가 정한다. 여기서 또 판정하면 두 곳이 같은 것을 정하게 되고,
갈리는 순간 어느 쪽이 진실인지 알 수 없게 된다. 우리가 보는 것은 **순서**뿐이다 —
초기화가 동의보다 먼저인가, 건너뛴 로드에 재시도가 걸려 있는가.

### 타게팅 불일치는 다수파를 기준으로 보고한다

어느 쪽이 맞는지는 하네스가 모른다. 하지만 **갈렸다는 사실**과 어느 포맷이 소수인지는 안다.
`groups` 에 전체 분할을 같이 실어 사람이 판단하게 한다.

## 5. 하지 말 것

- **실측 수익 수치와 퍼블리셔 ID 를 하네스에 복사하지 않는다.** 시점·계정 종속이라 빨리 낡고,
  조용히 낡은 수치가 틀린 확신을 만든다.
- **노출을 줄이라는 처방을 내지 않는다.** 지켜지지 않고, 지켜지지 않는 게이트는 꺼진다.
- **원격 설정 키 분류를 여기서 하지 않는다.** `nereus-game:liveops` 의 몫이다.
- **배치 타이밍을 여기서 정하지 않는다.** `adplacement` 가 한다.
