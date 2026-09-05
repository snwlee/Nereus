---
name: seo
description: 웹사이트 SEO 감사 체크리스트와 보고서 형식. 메타·구조화 데이터·Core Web Vitals·크롤링·내부 링크·키워드 매핑. "/nereus:seo", "SEO 점검", "검색 노출", "키워드", "Lighthouse" 요청 시 seo 에이전트가 사용.
---

# seo

nereus:common 규칙. 담당: seo. 수정 코드는 frontend 태스크로 넘긴다.

## 체크리스트 (각 항목 확인 결과와 근거를 적는다)
1. **크롤링**: robots.txt 차단 여부, sitemap.xml 존재·최신성, canonical, 4xx/5xx·리다이렉트 체인.
2. **메타**: 페이지별 title(≤60자, 고유), description(≤155자), OG/Twitter 카드, lang, viewport.
3. **구조화 데이터**: schema.org 타입(Organization, Article, Product, FAQ 등)과 필수 필드 누락. JSON-LD 유효성.
4. **Core Web Vitals**: chrome-devtools `lighthouse_audit` 모바일·데스크톱 각 1회. LCP<2.5s, INP<200ms, CLS<0.1. 수치는 표로.
5. **콘텐츠**: h1 하나, 헤딩 계층, 이미지 alt, 얇은 페이지, 중복.
6. **내부 링크**: 고아 페이지, 앵커 텍스트, 깊이 3 이상 페이지.
7. **키워드**: 대상 키워드를 의도(정보/거래/탐색)로 분류하고 현재 페이지에 매핑. 빈 의도를 표시. 조사는 nereus:research 절차.

## 출력
`docs/seo/<YYYY-MM-DD>-audit.md`: 점수표(항목별 ✅/⚠️/❌) → 발견 항목(심각도, 페이지, 수정안) → 키워드 맵 → frontend용 태스크 목록(`- [ ]` + 완료 조건). 랭킹 예측은 쓰지 않는다.
