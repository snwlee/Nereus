# 리소스 디렉터리 — 레퍼런스와 무료 리소스는 여기서 먼저 찾는다

확인일 **2026-11-27**. 스킬이 아니라 목록이다. 방향 후보·브리프 단계(0·1단계)에서 영감
사이트를 찾을 때, 그리고 아이콘·폰트·일러스트·팔레트·목업·스톡 사진 같은 무료 리소스를
고를 때 연다.

[designbookmark.com](https://designbookmark.com) — 디자인·개발·AI 도구 **2,871개** 디렉터리.
카테고리별 목록과 사람이 쓴 "best" 가이드가 있다. 모션 갤러리(`/motion`)는 `motion-refs.md` 가
따로 다룬다.

**한계부터 적는다.** 디렉터리는 **어디를 볼지**를 알려 줄 뿐이다. 무엇을 고를지는 여전히
방향 계약과 impeccable 비평이 정한다. 그리고 목록에는 돈을 내고 들어온 항목이 섞여 있다(아래 "주의").

## 가이드 — 사람이 쓴 "best" 목록

| 찾는 것 | 가이드 |
|---|---|
| 영감 — 실제 제품의 화면·흐름·랜딩 | [ui-design-inspiration-websites](https://designbookmark.com/best/ui-design-inspiration-websites) |
| 아이콘 (라이선스·스타일 포함) | [free-icon-libraries](https://designbookmark.com/best/free-icon-libraries) |
| 폰트 (상업 사용 가능한 것) | [free-font-websites](https://designbookmark.com/best/free-font-websites) |
| 색 팔레트 생성·접근성 검사 | [color-palette-generators](https://designbookmark.com/best/color-palette-generators) |
| 목업 (기기·브라우저 프레임) | [free-mockup-websites](https://designbookmark.com/best/free-mockup-websites) |
| 일러스트 | [free-illustration-websites](https://designbookmark.com/best/free-illustration-websites) |
| 스톡 사진 | [free-stock-photo-sites](https://designbookmark.com/best/free-stock-photo-sites) |

가이드 전체 목록은 [/best](https://designbookmark.com/best).

## 카테고리 — 가이드보다 넓게 볼 때

| 카테고리 | 링크 |
|---|---|
| 영감 (약 350개) | [/design/inspiration](https://designbookmark.com/design/inspiration) |
| 타이포그래피 | [/design/typography](https://designbookmark.com/design/typography) |
| 아이콘 | [/design/icons](https://designbookmark.com/design/icons) |
| 디자인 시스템 | [/design/design-systems](https://designbookmark.com/design/design-systems) |

## 쓰는 법

1. **필요할 때 찾아본다.** 해당 가이드 페이지를 열거나, 전체 목록 텍스트
   [`llms-full.txt`](https://designbookmark.com/llms-full.txt)(카테고리별, 항목마다 한 줄 설명과
   공식 사이트 링크)를 받아 **grep 한다.** 약 790KB 라 통째로 맥락에 넣지 않는다.
   짧은 사이트 안내는 [`llms.txt`](https://designbookmark.com/llms.txt).
2. **사이트 내용을 저장소에 복사하지 않는다.** 목록·설명을 옮겨 적지 않고 링크만 남긴다.
3. **요청 간격 10초.** robots.txt 가 AI 봇(ClaudeBot 포함)을 허용하되 `Crawl-delay: 10` 을 건다.
   여러 페이지를 볼 때는 사이에 10초를 둔다.

## 주의

- **돈으로 들어온 항목이 섞여 있다.** 등록에 심사비($9, 빠른 등록 $29)가 있고 스폰서 항목과
  제휴 링크가 있다. 사이트는 스폰서 표시를 한다고 하지만 `llms-full.txt` 에는 그 표시가 없다.
  그래서 **편집자 추천(featured 항목과 best 가이드)을 먼저 본다.** 카테고리 목록 순서를
  추천 순위로 읽지 않는다.
- **라이선스는 요약이다.** 가이드의 "무료"·"상업 사용 가능" 은 디렉터리의 요약일 뿐이다.
  쓰기 전에 **원 사이트의 라이선스 원문을 다시 확인한다**(`web-effect-repos.md` 와 같은 원칙 —
  라이선스 없음은 쓸 권리가 없다는 뜻이다). 폰트를 앱·게임에 임베딩하면 임베딩 조항까지 본다.
