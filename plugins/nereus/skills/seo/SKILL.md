---
name: seo
description: "SEO audit checklist (meta, structured data, CWV, crawling, keywords) and report. 트리거: \"SEO\", \"검색 노출\", \"Lighthouse\"."
---

# seo

nereus:common 규칙. 담당: seo. 수정 코드는 frontend 태스크로 넘긴다.

## 체크리스트 (각 항목 확인 결과와 근거를 적는다)
1. **크롤링**: robots.txt 차단 여부, sitemap.xml 존재·최신성, canonical, 4xx/5xx·리다이렉트 체인.
2. **메타**: 페이지별 title(≤60자, 고유), description(≤155자), OG/Twitter 카드, lang, viewport.
3. **구조화 데이터**: schema.org 타입(Organization, Article, Product, FAQ 등)과 필수 필드 누락. JSON-LD 유효성.
4. **Core Web Vitals**: Lighthouse 를 모바일·데스크톱 각 1회 돌린다. LCP<2.5s, CLS<0.1, TBT<200ms. 수치는 표로.
   ```bash
   npx -y lighthouse@12 <url> --only-categories=performance --form-factor=mobile --output=json --output-path=.nereus/lh-mobile.json --chrome-flags="--headless=new" --quiet
   npx -y lighthouse@12 <url> --only-categories=performance --preset=desktop --output=json --output-path=.nereus/lh-desktop.json --chrome-flags="--headless=new" --quiet
   ```
   실험실 측정은 **INP 를 내지 않는다** — TBT 를 대리 지표로 적고, 실사용 INP 는 CrUX·RUM 데이터가 있을 때만 적는다(지어내지 않는다).
5. **콘텐츠**: h1 하나, 헤딩 계층, 이미지 alt, 얇은 페이지, 중복.
6. **내부 링크**: 고아 페이지, 앵커 텍스트, 깊이 3 이상 페이지.
7. **키워드**: 대상 키워드를 의도(정보/거래/탐색)로 분류하고 현재 페이지에 매핑. 빈 의도를 표시. 숫자는 아래 '키워드 데이터 소스'에서 가져온다.

## 키워드 데이터 소스
웹 검색만으로는 검색량·난이도를 알 수 없다. 숫자 없이 고른 키워드는 아무도 검색하지 않는 주제일 수 있다.

- **OpenSEO MCP 가 연결돼 있으면**(`mcp__openseo__*` 도구가 보이면) 실측을 쓴다.
  - `research_keywords`: 시드 1~5개로 후보를 찾는다.
  - `get_keyword_metrics`: 후보에 검색량·KD·의도·CPC를 붙인다(최대 700개를 한 번에).
  - `get_serp_results`: 의도가 애매한 상위 후보만 SERP를 본다.
  - `get_ranked_keywords`: 경쟁 도메인이 순위를 가진 키워드를 본다.
  - 호출마다 DataForSEO 크레딧이 나간다. 시드를 먼저 줄이고 호출은 묶어서 한다. `save_keywords` 같은 쓰기 도구는 쓰지 않는다.
- **연결돼 있지 않으면** nereus:research 절차로 의도와 경쟁 페이지만 정리한다. 이때 키워드 맵 머리에 `실측 없음 — 검색량·KD 미확인`이라고 적고 숫자를 지어내지 않는다.
- 연결은 사용자가 고른다(유료 키). 방법은 nereus:setup 의 '선택 MCP' 절에 있다.

## 출력
`docs/seo/<YYYY-MM-DD>-audit.md`: 점수표(항목별 ✅/⚠️/❌) → 발견 항목(심각도, 페이지, 수정안) → 키워드 맵(검색량·KD·의도·대상 페이지, 출처 표시) → frontend용 태스크 목록(`- [ ]` + 완료 조건). 랭킹 예측은 쓰지 않는다.
