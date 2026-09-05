<p align="center">
  <img src="docs/assets/nereus-hero.webp" alt="Nereus" width="760">
</p>

<h1 align="center">Nereus</h1>

<p align="center">
  <strong>An opinionated development harness for Claude Code.</strong><br>
  인터뷰로 요구사항을 확정하고, 스펙을 세우고, TDD로 구현하고, 세 리뷰어가 검토하고, 컨텍스트가 차기 전에 다음 세션에 넘긴다.
</p>

<p align="center">
  <a href="https://github.com/snwlee/Nereus/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/snwlee/Nereus/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/snwlee/Nereus/releases"><img alt="Version" src="https://img.shields.io/github/v/tag/snwlee/Nereus?label=version&color=1f4e79"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey">
  <img alt="Runtime deps" src="https://img.shields.io/badge/runtime%20deps-0-brightgreen">
</p>

<p align="center">
  <a href="#설치">설치</a> ·
  <a href="#어떻게-동작하나">동작 방식</a> ·
  <a href="#커맨드">커맨드</a> ·
  <a href="#에이전트">에이전트</a> ·
  <a href="#훅">훅</a> ·
  <a href="#설정">설정</a> ·
  <a href="#외부-도구">외부 도구</a> ·
  <a href="#개발">개발</a>
</p>

---

## 왜 Nereus인가

코딩 에이전트는 두 지점에서 무너진다. **시작할 때** 모호한 요청을 추측으로 채우고, **끝날 무렵** 컨텍스트가 차서 지금까지의 판단을 잃는다. Nereus는 이 두 지점에 게이트를 세운다.

- **시작**: Ouroboros 소크라테스식 인터뷰가 숨은 가정을 드러내고, 모호성 점수가 0.2 이하로 내려가기 전에는 코드를 만지지 않는다.
- **중간**: 테스트 러너가 있는 프로젝트에서는 TDD를 훅으로 강제한다. 테스트보다 소스를 먼저 고치면 경고가 뜬다.
- **끝**: 컨텍스트 65%에서 현재 태스크만 마무리하고 `handoff.md`에 상태를 넘긴다. 80%는 하드 스톱. 새 세션은 그 파일에서 이어간다.
- **검토**: Alibaba Open Code Review의 결정론적 파일 선택 + Codex + Gemini(Antigravity), 세 리뷰어가 병렬로 본다. CRITICAL/HIGH가 하나라도 남으면 통과하지 못한다.

Nereus는 검증된 오픈소스를 **포함하지 않고 조합한다**. 인터뷰는 Ouroboros, 스펙은 spec-kit과 OpenSpec, 인덱싱은 CodeGraph, 메모리는 claude-mem, 리뷰는 Open Code Review가 한다. Nereus가 소유하는 것은 그 사이의 흐름, 게이트, 훅, 그리고 각 도구를 언제 누가 쓰는지에 대한 계약이다.

훅은 전부 Node 표준 라이브러리로만 쓰였다. bash 스크립트가 없어 macOS와 Windows에서 같은 파일이 그대로 돈다. 런타임 의존성은 0이다.

## 설치

Claude Code 안에서:

```
/plugin marketplace add snwlee/Nereus
/plugin install nereus@nereus
/nereus:setup
```

`setup`이 외부 도구 설치 상태를 표로 보여주고, 승인한 것만 설치한다. Windows는 PowerShell 명령을, macOS는 Homebrew 명령을 낸다. 요구 사항은 Node 20 이상과 Git뿐이다.

같은 마켓플레이스에 [CredStore](https://github.com/snwlee/CredStore) MCP 껍데기도 있다. 자격 증명 값을 저장하지 않고 카탈로그와 마스킹 실행만 제공한다.

```
/plugin install credstore@nereus
```

## 어떻게 동작하나

```
 intake ───▶ spec ───▶ build ───▶ e2e ───▶ review ───▶ finish
   │          │          │         │          │           │
 모호성      tasks     TDD +      [flow]     3 리뷰어    커밋 · archive
 ≤ 0.2      확정      ooo qa     태스크만    CRIT/HIGH 0  handoff 갱신
```

| 단계 | 하는 일 | 통과 조건 |
|---|---|---|
| **intake** | `ooo interview`로 요구사항을 파고든다. 작은 수정은 `--quick`. | 모호성 ≤ 0.2 |
| **spec** | 프로젝트를 자동 판별한다. 신규면 spec-kit(`constitution → specify → plan → tasks`), 기존이면 OpenSpec(`onboard → propose`). | 모든 태스크에 체크박스와 완료 조건 |
| **build** | 태스크마다 실패 테스트 → 최소 구현 → 리팩터. 러너가 없으면 세팅을 한 번 제안한다. | 테스트 전부 통과 + `ooo qa` 기계 검증 |
| **e2e** | `[flow]` 태그가 붙은 핵심 사용자 흐름만. 웹 Playwright, Flutter Patrol, Spring REST Assured. | 2회 재시도 후 통과. 간헐 실패는 격리, 삭제 금지 |
| **review** | OCR delegation + Codex + Gemini를 병렬 실행, 심각도별 병합. | CRITICAL/HIGH 0 |
| **finish** | conventional commit, OpenSpec archive, tasks 체크, handoff 갱신. 브랜치 정리는 묻는다. | — |

각 단계는 게이트를 통과하면 다음 단계를 스스로 부른다. 평소에는 `/nereus:intake` 하나만 기억하면 된다.

### Baton: 컨텍스트 핸드오프

진실은 대화가 아니라 디스크에 있다. `.nereus/handoff.md`, tasks 파일, git 커밋.

- `baton-meter` 훅이 transcript에서 컨텍스트 사용량을 읽는다. **65%**에서 "새 태스크 시작 금지, 현재 것만 마무리하고 handoff 작성"을 지시하고, **80%**부터는 handoff 작성 외의 진행을 막는다.
- 자동 압축이 먼저 오면 `PreCompact` 훅이 handoff 작성을 요구한다.
- 새 세션의 `SessionStart` 훅이 handoff를 주입한다. `/nereus:resume`은 handoff의 주장을 실제 테스트 실행으로 검증한 뒤 이어간다.
- `handoff.md`에는 **실패한 접근과 이유** 섹션이 있다. 다음 세션이 같은 시도를 반복하지 않게 하는 것이 이 파일의 가장 중요한 역할이다.

장기 자율 작업은 `/nereus:loop`가 맡는다. 반복마다 새 `claude -p` 세션이 handoff와 tasks만 읽고 태스크 하나를 끝내고 커밋한다. 종료 조건은 전부 완료 + 검증 통과, 최대 반복 도달, 같은 태스크 3회 실패다.

## 커맨드

| 커맨드 | 역할 |
|---|---|
| `/nereus:setup [--check]` | 외부 도구 감지·설치, 동반 플러그인 안내, 설정 파일 생성 |
| `/nereus:intake [--quick]` | 인터뷰로 요구사항 확정. 워크플로의 진입점 |
| `/nereus:spec` | spec-kit 또는 OpenSpec으로 스펙과 태스크 생성 |
| `/nereus:build` | 태스크를 TDD로 구현 |
| `/nereus:e2e` | `[flow]` 태스크의 엔드투엔드 검증 |
| `/nereus:review` | 세 리뷰어 병렬 리뷰와 게이트 판정 |
| `/nereus:finish` | 커밋, 아카이브, handoff 갱신 |
| `/nereus:handoff` | 지금 상태를 handoff.md에 전체 재작성하고 커밋 |
| `/nereus:resume` | handoff를 검증하고 이어서 작업 |
| `/nereus:loop "목표" --max N` | reset 루프로 장기 자율 작업 |
| `/nereus:pdf <file>` | Typst(기본) 또는 XeLaTeX로 PDF 생성. 템플릿 report/adr/research/spec, 한글 폰트 폴백 내장 |
| `/nereus:image` | Gemini로 이미지 생성. macOS는 로그인된 웹 세션(무료), Windows는 API 키 또는 쿠키 |
| `/nereus:research` | GitHub → 웹 → 커뮤니티 순으로 근거를 모아 보고서와 PDF 생성 |
| `/nereus:seo` | SEO 감사 체크리스트와 수정 태스크 목록 |

## 에이전트

에이전트는 얇다. 지식은 스킬에 두고, 에이전트는 **페르소나 + 허용 도구 + 출력 계약**만 가진다. 에이전트가 다른 에이전트를 직접 부르지 않는다. 오케스트레이션은 워크플로 스킬이 한다.

| 에이전트 | 언제 | 무엇을 들고 |
|---|---|---|
| `architect` | intake, spec | Ouroboros, spec-kit/OpenSpec, archify, Context7 |
| `backend` | Spring / Node 서버 태스크 | CodeGraph, Context7 |
| `frontend` | 웹 UI 태스크 | impeccable, chrome-devtools, Playwright |
| `app` | Flutter / Dart 태스크 | Context7, Patrol |
| `researcher` | 시장·기술 조사 | WebSearch, last30days, Agent-Reach, gh search |
| `seo` | SEO 감사 | Lighthouse, 감사 체크리스트 |
| `reviewer` | review 단계 | Open Code Review, Codex, Gemini |
| `security` | 인증·입력·외부 호출 변경 시 자동 | SkillSpector, strix, CredStore |
| `qa` | `[flow]` 태스크, review 직전 | e2e 스킬, `ooo qa` |
| `writer` | finish, 문서 요청 | archify, Typst PDF, ADR |

프로젝트별로 다른 팀이 필요하면 [revfactory/harness](https://github.com/revfactory/harness)로 `.claude/agents/`에 추가하면 된다. 위 열 개는 건드리지 않는다.

## 훅

| 이벤트 | 스크립트 | 동작 |
|---|---|---|
| SessionStart | `session-start.mjs` | handoff.md 주입, CodeGraph 인덱스와 외부 도구 상태 한 줄 |
| PostToolUse (Edit/Write) | `tdd-guard.mjs` | 테스트 없이 소스를 먼저 편집하면 경고. 차단은 하지 않는다 |
| PostToolUse (*) | `baton-meter.mjs` | 컨텍스트 사용률 측정, 65% 경고, 80% 하드 스톱 |
| PreCompact | `pre-compact.mjs` | 압축 전에 handoff 작성 요구 |
| Stop | `finish-check.mjs` | 미커밋 변경이나 갱신 안 된 handoff가 있으면 알림 |
| SessionEnd | `session-end.mjs` | 요약 저장은 claude-mem에 위임. 없으면 안내만 |

모든 훅은 `node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<name>.mjs"`로 실행된다. 각 스크립트는 `handle(input, deps)` 순수 함수로 짜여 있어 파일시스템과 외부 명령을 주입해 테스트한다.

## 설정

사용자 전역 `~/.config/nereus/config.json` (Windows: `%APPDATA%\nereus\config.json`). 프로젝트의 `.nereus/config.json`이 있으면 그 값이 우선한다.

```json
{
  "secondOpinion": "both",
  "baton": { "warn": 0.65, "hard": 0.8 },
  "tdd": { "exclude": ["**/migrations/**", "**/*.config.*", "**/*.d.ts", "**/generated/**", "**/*.g.dart", "**/*.freezed.dart"] },
  "pdf": { "engine": "typst", "font": "Noto Sans KR" },
  "image": { "backend": "auto" }
}
```

| 키 | 값 | 의미 |
|---|---|---|
| `secondOpinion` | `both` \| `codex` \| `gemini` | review 단계의 2차 의견 리뷰어 |
| `baton.warn` / `baton.hard` | 0~1 | 컨텍스트 경고 / 하드 스톱 비율 |
| `tdd.exclude` | glob 배열 | TDD 경고에서 제외할 파일 |
| `pdf.engine` / `pdf.font` | `typst` \| `latex` | PDF 엔진과 한글 폰트. 폰트가 없으면 Apple SD Gothic Neo, Malgun Gothic 순으로 폴백 |
| `image.backend` | `auto` \| `web` \| `api` | `auto`는 macOS면 웹 세션, 그 외는 `GEMINI_API_KEY` |

## 외부 도구

Nereus는 아래 도구를 **호출만** 한다. 저장소에 포함하지 않으므로 각 도구의 업데이트가 그대로 반영된다. `/nereus:setup`이 설치 여부를 확인한다.

| 역할 | 도구 | 필수 |
|---|---|---|
| 인터뷰, 검증 게이트, 막힘 해소 | [Ouroboros](https://github.com/Q00/ouroboros) (`ooo`) | ● |
| 신규 프로젝트 스펙 | [spec-kit](https://github.com/github/spec-kit) (`specify`) | ● |
| 기존 프로젝트 스펙 | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | ● |
| 코드 인덱싱 | [CodeGraph](https://github.com/colbymchenry/codegraph) | ● |
| 코드 리뷰 | [Open Code Review](https://github.com/alibaba/open-code-review) (`ocr`) | ● |
| 2차 의견 | [Codex CLI](https://github.com/openai/codex), [Antigravity CLI](https://antigravity.google) (`agy`) | ● |
| PDF | [Typst](https://typst.app) | ● |
| 세션 메모리 | [claude-mem](https://github.com/thedotmack/claude-mem) | 권장 |
| 디자인 | [impeccable](https://github.com/pbakaus/impeccable) | 권장 |
| 다이어그램 | [archify](https://github.com/tt-a1i/archify) | 권장 |
| 토큰 절감 | [rtk](https://github.com/rtk-ai/rtk) | 선택 |
| 스킬 보안 스캔 | [SkillSpector](https://github.com/NVIDIA/SkillSpector) | 선택 |
| 앱 보안 | [strix](https://github.com/usestrix/strix) | 선택 |
| LaTeX 엔진 | XeLaTeX + kotex | 선택 |

Context7과 chrome-devtools MCP 서버는 플러그인의 `.mcp.json`에 선언되어 있어 별도 설치가 필요 없다.

## Windows

- 훅과 스크립트는 Node만 요구한다. Git Bash나 WSL이 없어도 된다.
- 외부 CLI는 `PATHEXT`를 해석해 `.cmd`/`.exe`를 찾는다.
- 설정 디렉터리는 `%APPDATA%\nereus`.
- Gemini 이미지 생성은 Chrome의 App-Bound Encryption 때문에 쿠키 자동 추출이 되지 않는다. `GEMINI_API_KEY`를 쓰거나 쿠키를 수동으로 저장한다. 스킬이 두 경로를 모두 안내한다.
- CI는 `macos-latest`와 `windows-latest` 매트릭스에서 돈다.

## 개발

```bash
npm ci
npm test                    # vitest, 72 tests
npm run coverage            # 임계값 lines 80 / functions 80
claude plugin validate .    # 마켓플레이스·플러그인 매니페스트 검증
```

로컬에서 바로 설치해 시험하려면:

```
/plugin marketplace add /path/to/Nereus
/plugin install nereus@nereus
```

같은 버전은 `update`가 다시 받지 않으므로, 변경 후에는 버전을 올리거나 `uninstall` 후 `install`한다.

```
Nereus/
├── .claude-plugin/marketplace.json     # nereus, credstore
├── plugins/nereus/
│   ├── agents/                         # 10개
│   ├── skills/                         # 16개 (SKILL.md + scripts/)
│   ├── hooks/hooks.json, hooks/scripts/*.mjs
│   └── .mcp.json                       # browser(chrome-devtools), context7
├── plugins/credstore/
├── docs/specs/                         # 설계 문서
└── tests/                              # vitest
```

설계 문서: [`docs/specs/2026-09-05-nereus-harness-design.md`](docs/specs/2026-09-05-nereus-harness-design.md)

## 로드맵

- [ ] 80% 도달 시 훅이 기계적 handoff 스켈레톤(최근 커밋, git status, tasks 상태)을 자동 저장
- [ ] Stop 훅이 handoff 미갱신 시 종료를 한 번 차단
- [ ] `intake-router`: 새 작업 요청을 감지해 intake를 자동 제안
- [ ] CredStore `kind: keychain` (macOS Keychain / Windows Credential Manager)
- [ ] CredStore npm 게시

## 라이선스

[MIT](LICENSE) © 2026 snwlee

Nereus는 위 외부 도구들의 코드를 포함하지 않는다. 각 도구는 자체 라이선스를 따른다.
