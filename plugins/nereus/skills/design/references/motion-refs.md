# 모션 레퍼런스 — 사람이 고르고, 코드는 라이선스 있는 곳에서만

확인일 **2026-11-16**. 스킬이 아니라 목록이다. 방향 단계(1단계)에서 "이 버튼은 이런 느낌"을
정할 때 열어 본다.

**한계부터 적는다.** 이 갤러리들의 가치는 **라이브로 돌아가는 데모**에 있다. 그런데 에이전트가
페이지를 텍스트로 가져오면 이름과 버튼만 남는다. 그래서 에이전트는 여기서 링크를 짚어 주고,
**동작은 사람이 보고 고른다.** 에이전트가 직접 가져다 쓸 수 있는 코드는 MIT 저장소의 것뿐이다.

| 출처 | 규모 | 라이선스 | 쓰는 법 |
|---|---|---|---|
| [designbookmark.com/motion](https://designbookmark.com/motion) | 자체 52개 + 외부 링크 31개 | **없음** (약관에 코드 재사용 조항이 없다) | **보기만 한다.** "Copy for Claude" 결과를 붙여넣지 않는다 |
| [kokonutui.com](https://kokonutui.com) · `kokonut-labs/kokonutui` | 2,336★ | **MIT** | 저장소에서 파일을 찾을 수 있는 컴포넌트만 쓴다 |
| [smoothui.dev](https://smoothui.dev) · `educlopez/smoothui` | 1,059★ | **MIT** | 같다 |

DesignBookmark 의 외부 항목 31개는 위 두 곳(Kokonut UI·SmoothUI)으로 가는 링크다. 그래서
그 항목은 원 저장소에서 가져오면 라이선스 문제가 없다.

`refaxD/DesignBookmark-Motion-SKILL` 이라는 스킬화 저장소가 이미 있는데, **라이선스가 없다.**
쓸 권리를 받지 않았으니 설치하지 않는다(`web-effect-repos.md` 와 같은 판단).

## 스프링 어휘 — 역할별 프리셋

DesignBookmark 의 공유 토큰(`shared/tokens.css`)에서 역할별 프리셋 수치만 옮겼다. 2026-11-16 Aside 로
"Copy code" 를 열어 확인했다(로그인 없이 복사된다. 의존성 없는 단일 HTML, 질량 1 스프링 엔진).
**코드는 옮기지 않았다** — 라이선스가 없다. 수치는 framer-motion·react-spring·SwiftUI 어디서나
`stiffness`/`damping` 으로 그대로 쓴다.

| 역할 | stiffness/damping | 감쇠비 ζ | 느낌 |
|---|---|---|---|
| follow — 포인터가 잡고 있는 것 | 900/50 | 0.83 | 오버슈트·지연 없음 |
| settle — 놓았을 때, 값에 안착 | 280/22 | 0.66 | 작은 오버슈트 한 번 |
| soft — 패널·시트 등 큰 이동 | 260/24 | 0.74 | 느긋하게 |
| lead — 늘어나는 하이라이트의 앞 가장자리 | 620/36 | 0.72 | 빠르게 출발 |
| trail — 같은 하이라이트의 뒤 가장자리 | 190/19 | 0.69 | 늦게 따라와서 늘어남을 만든다 |
| pop — 선택 시 아이콘·숫자 | 520/16 | 0.35 | 가장 탱탱하다 |
| fade — 불투명도·작은 슬라이드 | 420/32 | 0.78 | 튀지 않게 |

ζ = damping / (2·√stiffness). 1 에 가까울수록 튀지 않는다. 연속 등장 간격(stagger)은 45ms.
읽는 법: **잡고 있는 동안은 ζ≈0.8 이상, 놓은 뒤와 선택 피드백에만 탄성을 준다.** lead/trail 은
같은 요소의 두 가장자리에 서로 다른 스프링을 걸어 "늘어나는" 느낌을 만드는 기법이다.
reduced-motion 에서는 같은 stiffness 에 임계 감쇠(damping = 2√stiffness)로 바꾼다.

## 카테고리로 찾기

DesignBookmark 필터 탭 이름을 그대로 쓴다: Buttons · Inputs · Navigation · Cards · AI · Text.

## 가져올 때

1. MIT 라도 **사이트에 있다고 저장소에 있는 것은 아니다.** 저장소에서 파일 경로를 찾을 수 있을 때만 쓴다.
2. 통째로 의존성에 넣지 않는다. 필요한 효과 하나만 떼어 적응시킨다. 저작권 고지는 남긴다.
3. 가져온 코드도 `scripts/motion-check.mjs` 를 통과시킨다. 갤러리 코드에도 `transition: all`
   이나 reduced-motion 누락이 흔하다.
4. 모션의 판정은 여전히 impeccable 비평(`critique`)이 한다. 레퍼런스를 따랐다고 통과되는 것은 아니다.
