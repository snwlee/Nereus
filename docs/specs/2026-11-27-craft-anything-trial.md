# craft-anything 시험 기록 — 웹사이트 clean-room 관찰만 (2026-11-27)

[craft-anything](https://github.com/storytold/craft-anything) (Apache-2.0 / MIT, v0.6.1) 의
**웹사이트 clean-room 관찰 기능**이 `nereus:design` 의 레퍼런스 수집을 실제로 보강하는지
레퍼런스 사이트 1곳(https://linear.app)으로 시험했다. 이 문서는 선례
([ui-ux-pro-max 채택 기록](2026-09-07-ui-ux-pro-max-adoption.md))와 같은 틀로
**보안 판정 근거**와 **연결 방식 결정 근거**를 남긴다. Nereus 자체(스킬·hooks·플러그인·MCP 설정)는
이번에 바꾸지 않았다.

## 판정: 채택 (레퍼런스 수집 보조 도구로만, 옵트인)

- 쓰는 것: `web_site_open` → `web_site_capture` → `web_page_states_capture` → `web_site_close`
  네 도구뿐. **항상 `--clean-room`**.
- 쓰지 않는 것: `setup`(에이전트 앱 등록·스킬 설치), `mcp` 의 상시 등록, `rebuild`(빌드 루프),
  Deep 모드, fal.ai 에셋 생성, AI 백엔드 설정.
- 상시 토큰 0 을 유지한다. 필요할 때 프로세스를 띄우고 끝나면 닫는다.

통째 도입(MCP 320개 도구, 자체 Claude Code 빌드 루프)은 하지 않는다는 오너 결정은 그대로다.
시험으로 그 결정의 근거가 하나 더 생겼다: `craft-anything-cli mcp` 를 등록하면 **기본으로 노출되는
도구만 30개, 목록 31KB(≈8k 토큰)** 가 상시 컨텍스트에 들어간다. v0.5.1 에서 상시 토큰을
1,842 로 깎은 것의 4배가 넘는다.

## 왜 시험했나

`nereus:design` 1단계(direction)는 "레퍼런스는 이미지로 붙인다"고 요구하고, Gemini·impeccable 비평은
반복해서 "구체적 팔레트·타이포 페어링·간격"을 요구한다. 지금 수집 방식(agent-browser/Playwright
스크린샷 + 수동 관찰)은 **그림**은 주지만 **수치**는 주지 않는다. 브리프의 팔레트·폰트 크기·간격은
스크린샷을 보고 눈으로 추정해 적는다. craft-anything 은 clean-room 모드에서도 "방문자가 보는 것"의
측정값(계산된 스타일)을 뽑는다고 해서 그 공백을 메우는지 확인했다.

## 보안 판정: 릴리스 바이너리로 시험 가능

### 소스 빌드 대신 릴리스 바이너리를 고른 근거

| 확인 | 결과 |
|---|---|
| SHA256 | `craft-anything-cli-0.6.1-macos-universal.zip` = `ddbae05f…988c2f`, `SHA256SUMS.txt` 와 일치 (`shasum -c` OK) |
| 체크섬 서명 | `SHA256SUMS.txt.asc` Good signature, ed25519 `2B76741B414AAD6CD33E631213A005C0B9D7C3ED` (uid "ArtCraft Linux Release Signing Key"). 키가 같은 릴리스에 실려 있어 TOFU 수준 |
| 코드서명 | `Developer ID Application: Learning Machines LLC (DJ6XS33FX8)`, hardened runtime |
| Gatekeeper | `spctl` → `accepted, source=Notarized Developer ID` |
| SLSA attestation | 없음 (`gh attestation verify` → 404) |

소스 빌드는 Rust 1.97+ 와 대형 워크스페이스 컴파일이 필요해 시험 비용이 크고, 바이너리는
노터라이즈 + 서명된 체크섬이라 "릴리스 자산이 바뀌지 않았다"는 것은 확인된다. 다만
**배포물이 태그 소스에서 빌드됐는지는 검증할 수 없다**(attestation 없음, 재현 빌드 안 함).
그래서 실행 표면은 v0.6.1 태그 소스(shallow clone)를 읽어 따로 감사했다.

### 실행 표면 감사 (태그 v0.6.1 소스)

- **텔레메트리 없음.** `telemetry|analytics|sentry|posthog|mixpanel|amplitude` 검색 결과는 전부
  파일시스템 파서 주석과 aider 어댑터의 `--no-analytics` 플래그였다. 하드코딩된 외부 호스트도
  AI 백엔드(api.anthropic.com·openai·openrouter 등, 설정 시에만), fal.media(키 있을 때만),
  엔진 설치용 GitHub 릴리스 URL(Ghidra·JADX 등, 명시 설치 시에만)뿐이다.
- **업데이트 체크는 데스크톱 앱(`ui-egui/src/updates.rs`)에만 있다.** CLI 에는 없다.
- HTTP 클라이언트(`ureq`)는 `engines`(설치·fal·외부 MCP 클라이언트)와 `ai/http` 에서만 쓰인다.
  웹사이트 관찰 도구는 쓰지 않는다 — 관찰 트래픽은 전부 Chrome 이 대상 사이트로 낸다.
- Chrome 은 **새 임시 프로필**로 뜬다: `--user-data-dir=<temp>`, `--no-first-run`,
  `--disable-background-networking`, `--disable-sync`, `--remote-debugging-port=0`.
  `web_site_close` 가 프로필을 지운다. 로그인·쿠키가 없으니 오너 계정이 노출될 경로가 없다.
- **설치 시 실행되는 코드 없음.** zip 을 푼 것이 전부다(바이너리 + 라이선스 텍스트, 65MB).
  `doctor`·`commands`·관찰 실행 뒤에도 `~/Library/Application Support`·`~/Library/Preferences`·
  `~/.config`·`~/Documents` 에 craft 관련 파일이 생기지 않았다.
- `doctor` 는 **읽기만** 한다: 16개 에이전트 앱(Claude Code 포함)을 찾아 "연결 안 됨"으로 보고하고,
  `setup --client …` 을 안내만 한다. **`setup` 은 `~/.claude/skills` 등에 스킬을 설치하고 MCP 를
  등록한다 — 실행 금지.** (그러면 `nereus:design` 과 트리거가 겹치고 상시 토큰이 붙는다.)
- clean-room 은 도구 단위로 실제로 거절된다: `web_pages_list`·`web_page_js_analyze` 가
  `feature_missing / reason: clean_room` 으로 거부됐고, `web_site_capture` 는 `include_html` 을
  강제로 `false`, `visitor_view: true` 로 바꿨다. README 가 밝히듯 **OS 샌드박스는 아니다** —
  사이트 스크립트는 우리 Chrome 에서 돈다(`--allow-run` 이 필요한 이유).

**공급망 메모.** `release.yml` 이 `storytold/craft-common-actions/.github/workflows/release.yml@main`
을 **SHA 고정 없이** 쓴다(주석에 의도라고 적혀 있다). 버전을 올릴 때마다 위 SHA256·서명·노터라이즈
확인을 다시 하고, 버전을 고정해 쓴다.

**판정: 레퍼런스 수집 용도로 채택 가능.** 키·결제·계정 없이 돌고, 외부 송신은 Chrome 이 관찰 대상
사이트로 내는 요청뿐이다.

## 시험 결과: linear.app, 폭 320 / 768 / 1440

### 무엇이 새로 생기나

`web_site_capture` (clean-room) 산출물 — `README.md`(5KB 요약) + `capture.json`(95KB) + 폭별 전체
페이지 PNG + 노이즈 마스크:

| 항목 | linear.app 실제 값 (발췌) | 지금 방식으로는 |
|---|---|---|
| 배경색 (빈도순) | `#08090a`, `#0f1011`, `#161718`, `#ffffff05`·`#ffffff0d`·`#ffffff14` 오버레이, 액센트 `#5e6ad2` | 스크린샷에서 눈으로 추정 |
| 글자색 | `#f7f8f8` / `#d0d6e0` / `#8a8f98` / `#62666d` 4단계 | 추정 |
| 폰트 | `Inter Variable` (189회) + `Berkeley Mono` (2회), 굵기 400/510/590 | 추정(510·590 같은 가변 굵기는 눈으로 못 맞힌다) |
| 글자 크기 | 13·12·15·24·14·38·11·16px (빈도순) | 추정 |
| 라운드 | 8px·9999px·4px·6px·50% | 추정 |
| 그림자 | `rgba(255,255,255,.05) 0 0 0 1px inset` 등 정확한 값 | 사실상 불가 |
| 간격 | 8·6·4·7·12·16·2·24·30px … (빈도순) | 추정 |
| 폭별 레이아웃 | 제목 크기 320=38/24/20, 768=56/32/20, 1440=64/48/20; 섹션 상하 패딩 768=48/96 → 1440=128/128; 행당 항목 수 | 폭별로 스크린샷을 나란히 보고 추정 |
| 메뉴 상태 | Product·Resources 등 드롭다운 4개를 하나씩 열어 `state-n.png` + 무엇이 바뀌었는지 | 수동 클릭 + 스크린샷 |
| 접근성 개요 | landmark 수, alt 없는 이미지 0, 이름 없는 버튼 1 | agent-browser `snapshot`(a11y 트리)로 가능 |
| 노이즈 마스크 | 스스로 바뀌는 영역(애니메이션) 마스크 PNG | 없음 |

**핵심: direction 브리프의 팔레트·타이포·간격을 "측정값"으로 쓸 수 있게 된다.** 이것이 지금 방식에
없던 것이고, 비평 라운드가 반복해서 요구한 바로 그 정보다.

### 시간·출력 크기

| | craft-anything (clean-room) | agent-browser (지금 방식) |
|---|---|---|
| 걸린 시간 | 열기 4.0s + 3폭 캡처 22.0s + 메뉴 4개 5.8s + 닫기 2.3s ≈ **34s** | 3폭 전체 스크린샷 + a11y 스냅샷 **10s** |
| 스크린샷 | 320×6031 / 768×9599 / 1440×9990, 지연 로딩 콘텐츠까지 렌더 | 320×6031 / 768×9537 / 1440×9990 (같은 1440 비교: perceptual 0.990, layout 0.998 — 사실상 동일) |
| 텍스트 출력 | `README.md` 5.2KB (≈1.3k 토큰) — 요약만 읽으면 된다. 도구 응답 12KB, `capture.json` 95KB(≈25k 토큰, 37KB 가 outline) | a11y 스냅샷 36KB (≈9k 토큰), 수치 없음 |
| 디스크 | 캡처 4.3MB + 메뉴 상태 1.5MB | 6.4MB |

토큰 비용 결론: **`README.md` 만 읽으면 지금 방식보다 적은 토큰으로 더 많은 정보**를 얻는다.
`capture.json` 은 통째로 읽지 말고 `design`·`layouts` 키만 골라 읽는다. 스크린샷 이미지 토큰은
두 방식이 같다.

### 실패·누락·주의점

- **CLI 단독 호출로는 안 된다.** CLI 명령 하나가 브라우저를 띄우고 끝날 때 닫기 때문에
  `web-site-open` 다음 `web-site-capture` 를 따로 부르면 `no website is open` 이 난다.
  한 세션에서 돌리려면 `craft-anything-cli --clean-room --allow-run mcp` 를 stdio 로 띄우고
  JSON-RPC 로 `enable_toolset{browser}` → 도구 호출을 이어 보내야 한다. 시험에는 표준 라이브러리만 쓴
  50줄짜리 드라이버(`mcp_drive.py`)를 썼다. 이것은 **일회성 프로세스**라 상시 등록과 다르다.
- **README 요약의 "column N px" 는 렌더 폭이 아니라 `max-width` 다.** 320px 폭에서
  "column 1376 px at x 0" 처럼 나온다. `capture.json` 의 `layouts[].blocks[].column` 에는 `w`(실제 폭)와
  `max_w` 가 따로 있으니 판단은 그쪽으로 한다.
- 노이즈 마스크는 320·768 만 생기고 1440 은 생기지 않았다(1440 에서 바뀐 부분이 없었던 것으로 보이나
  확인하지 않았다).
- clean-room 이라 CSS 규칙을 읽지 않으므로 **브레이크포인트 목록은 나오지 않는다**(도구 설명에 있는
  "CSS 가 레이아웃을 바꾸는 폭"은 Deep 전용). 폭별 레이아웃 차이로 간접 추정만 된다.
- 메뉴 상태 캡처는 첫 컨트롤 몇 개만 열고, 호버 전용 메뉴·중첩 메뉴는 열지 않는다(도구가 스스로 밝힘).
- 로그인 뒤 화면은 볼 수 없다(새 프로필). 레퍼런스 용도로는 문제없다.

## 화면 폭 3개 비교: 두 URL 사이엔 "픽셀 비교까지만" 된다

- 빌드 없이 두 URL(레퍼런스 linear.app vs 오너의 기존 GitHub Pages 페이지)을 각각
  `web_site_capture`(3폭)한 뒤 폭별로 `web-pixels-compare --common-area` 를 돌리면 **된다**.
  `web-pixels-compare` 는 순수 계산이라 CLI 단독 호출로 동작한다. 결과는 폭별
  `layout_similarity`(16px 타일 평균색 일치율)·`perceptual_similarity`(SSIM)·차이 비율·변경 영역이다.
  이번 쌍은 어두운 테마 vs 밝은 테마라 320/768/1440 모두 perceptual 0.03~0.04, layout 0.00~0.02 로
  당연히 "전혀 다름"이 나왔다 — 서로 다른 두 사이트에는 이 숫자가 정보가 거의 없다.
- **패딩·색·폰트·레이아웃 차이를 문장으로 알려주는 비교(`rebuild_check`)는 두 URL 사이에 안 된다.**
  `rebuild_check` 는 진행 중인 rebuild 런에 `checks/asks/` 로 요청을 넣고, 프로젝트의 `app/` 을 직접
  띄워 원본 캡처와 비교한다. 즉 빌드 프로젝트가 있어야 한다. 그 차이 문장을 만드는 `design_notes()`
  (`crates/ai/src/rebuild/kinds/website.rs`)는 두 `capture.json` 의 `design`·`layouts` 를 비교하는
  단순 함수지만 도구로 노출돼 있지 않다. 필요하면 같은 규칙(상위 6색·주 폰트·상위 8개 글자 크기/간격·
  폭별 제목 크기 ±2px·섹션 패딩/행당 항목)을 우리 쪽에서 몇십 줄로 재현할 수 있다 — 이번에는 하지 않는다.

## 연결 방식 (채택 시, 아직 구현하지 않음)

ui-ux-pro-max 와 같은 원칙: **스킬·MCP 로 설치하지 않고, 저장소 밖 바이너리를 필요할 때만 직접 호출**한다.

1. 설치 위치: `~/.local/share/nereus/craft-anything/<버전>/craft-anything-cli`
   (릴리스 zip, SHA256·서명·`spctl` 확인 후 풀기만). 탐색은 `$NEREUS_CRAFT_ANYTHING` → 위 경로.
   없으면 이 단계를 건너뛰고 지금 방식(agent-browser 스크린샷)으로 간다.
2. 단계: **`nereus:design` 1단계(direction) 의 레퍼런스 수집**에서, 브리프에 레퍼런스 URL 이 있을 때만.
   2단계(visual) 비평은 impeccable 이 계속 소유한다.
3. 호출: `design/scripts/` 아래 래퍼(가칭 `reference-capture.mjs`)가 `--clean-room --allow-run mcp` 를
   자식 프로세스로 띄워 `enable_toolset{browser}` → `web_site_open` → `web_site_capture`
   (`widths` = `design.widths`, 기본 320/768/1440, `noise_pass`) → `web_page_states_capture`(max 4) →
   `web_site_close` 를 보내고 종료한다. 산출물은 `.nereus/design/refs/<host>/` 에 둔다.
4. 브리프 반영: 스크린샷 PNG 는 레퍼런스 이미지로 붙이고, `README.md` 의 "Design at a glance" 와
   폭별 제목 크기·섹션 패딩만 브리프에 옮긴다. `capture.json` 전체는 컨텍스트에 넣지 않는다.
5. 금지: `setup`, `mcp` 상시 등록, `rebuild`, `--deep`, AI 백엔드·fal 키 설정.

상시 토큰은 0 그대로다(스킬 description 추가 없음, MCP 등록 없음).

## 비용·위험 요약

- 비용: 디스크 65MB(바이너리), 레퍼런스 1곳당 ≈35초, 읽는 토큰 ≈1.3k(README) + 이미지.
- 위험: 알파 소프트웨어(측정 라벨 오류 1건 확인), 릴리스 워크플로가 공용 액션 `@main` 미고정,
  provenance attestation 없음, 관찰 중 대상 사이트 스크립트가 로컬 Chrome 에서 실행됨(임시 프로필).

## 재현 (시험 때 쓴 위치 — 저장소 밖)

```text
~/.cache/nereus-trials/craft-anything/
  dl/       릴리스 zip, SHA256SUMS.txt(.asc), release-signing-key.asc
  bin/      풀어 둔 CLI (craft-anything-cli-0.6.1-macos-universal/)
  src/ca/   v0.6.1 태그 shallow clone (감사용, 빌드하지 않음)
  scripts/  mcp_drive.py — MCP stdio 일회성 드라이버
  out/      linear-capture/, linear-states/, resume-capture/, baseline/, cmp-*.json, run1.jsonl
```

```bash
CLI=~/.cache/nereus-trials/craft-anything/bin/craft-anything-cli-0.6.1-macos-universal/craft-anything-cli
$CLI doctor          # 읽기만 함
$CLI commands        # Websites 툴셋 22개
python3 -I scripts/mcp_drive.py "$CLI" calls.json run.jsonl   # calls.json = 위 4개 도구 호출 목록
$CLI web-pixels-compare --json '{"before":{"path":".../a-1440.png"},"after":{"path":".../b-1440.png"},"common_area":true,"tolerance":16}'
```
