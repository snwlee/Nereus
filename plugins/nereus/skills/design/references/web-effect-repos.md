# 웹 이펙트 저장소 — 참고 전에 라이선스부터

출처: 인스타그램 릴스(@cindie.zhu, "4 GitHub repos to steal"). 확인일 **2026-09-15**.
그 영상 자체가 옳은 말을 한다 — *"라이선스·유지보수·프레임워크를 먼저 확인하라."*
실제로 확인해 보니 **넷 중 안전하게 쓸 수 있는 건 하나뿐이다.**

| # | 저장소 | 별 | 라이선스 | 판정 |
|---|---|---|---|---|
| 1 | `pmndrs/threejs-journey` (Bruno Simon 데모의 R3F 이식) | 810 | **없음** | **채택 불가** — 원 강의는 유료다 |
| 2 | [`dashersw/liquid-glass-js`](https://github.com/dashersw/liquid-glass-js) | 1,001 | **MIT** | **쓸 수 있다** |
| 3 | `ruucm/shadergradient` | 2,447 | **없음** | **채택 불가** |
| 4 | `paper-design/liquid-logo` | 1,090 | **NOASSERTION**("other") | **보류** — 원문을 읽기 전엔 판단 못 한다 |

**라이선스 없음은 GPL 보다 더 막힌다.** 별이 2,447 이어도 쓸 수 없다 —
쓸 권리를 준 적이 없기 때문이다. 이 판단은 3D 조사에서 스킬팩 3종(3,291★ 포함)을
같은 이유로 버린 것과 같다.

## 경계 — `nereus-3d` 가 아니다

넷 중 어느 것도 `nereus-3d` 에 들어가지 않는다.

- `nereus-3d` 는 three.js **검사기**다 — dispose 누락·드로우콜·GPU 누수를 잡는다.
  이펙트 라이브러리 모음이 아니다.
- `liquid-glass-js` 는 **DOM/CSS/SVG** 다. three.js 를 쓰지 않는다.
- `liquid-logo` 는 **Paper Shaders**(WebGL) 다. three.js 가 아니다.
- 그래서 여기(디자인 표면)에 둔다.

## 쓸 때

저장소는 **참고 코드이지 가져다 붙이는 에셋이 아니다.** 필요한 **가장 작은 효과 하나만**
떼어내 버릴 수 있는 브랜치에서 적응시킨 뒤 합친다. 통째로 의존성에 넣지 않는다 —
`nereus:build` 의 게으름 사다리 5단("이미 설치된 의존성이 푸나")이 먼저다.

MIT 라도 **저작권 고지를 남긴다.**
