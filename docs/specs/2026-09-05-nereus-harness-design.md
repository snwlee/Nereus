# Nereus 하네스 설계

작성일: 2026-09-05
상태: 승인됨 (구현 계획 작성 전)

## 1. 목적

Claude Code용 개인 개발 하네스. 마켓플레이스로 배포해 macOS와 Windows 어디서든 같은 워크플로, 에이전트, 훅을 쓴다. 기존에 설치된 플러그인(superpowers, ecc 등)과 독립적으로 동작하며, 검증된 오픈소스를 직접 포함하지 않고 래퍼로 호출한다.

주력 스택: Flutter/Dart, Java/Spring, TypeScript/JS.

## 2. 접근 방식

**단일 코어 플러그인 + 외부 도구 래퍼.** 저장소 하나가 마켓플레이스이고 플러그인 두 개(`nereus`, `credstore`)를 담는다. 외부 도구는 설치 확인 후 CLI나 MCP로 호출한다. 덩어리가 커지면 플러그인을 더 쪼갤 수 있도록 마켓플레이스 파일은 처음부터 둔다.

기각한 대안:
- 처음부터 플러그인 여러 개로 분리: 혼자 쓰는 하네스에서 의존 관리 비용만 늘어난다.
- 외부 도구 포크 내장: 20개 가까운 활발한 프로젝트를 수동으로 따라갈 수 없다.

## 3. 외부 도구 선정

겹치는 영역은 하나만 고른다. 기준은 최근 활동, 라이선스, Windows 지원, 에이전트 친화성.

| 영역 | 선택 | 탈락 | 이유 |
|---|---|---|---|
| 인터뷰·검증 | Q00/ouroboros | - | interview, unstuck, evaluate, pm, publish 사용. 자체 Seed/run은 spec-kit과 겹쳐 미사용 |
| 신규 스펙 | github/spec-kit | - | constitution → specify → plan → tasks |
| 기존 스펙 | Fission-AI/OpenSpec | - | onboard로 역스펙화, propose → apply → archive |
| 태스크 관리 | (없음) | claude-task-master | 4개월 정지, Commons Clause, spec-kit/OpenSpec/ouroboros publish가 커버 |
| 코드 인덱싱 | colbymchenry/codegraph | codebase-memory-mcp, code-review-graph, claude-context | 자동 동기화, 검증됨. 나머지는 동급이거나 pip/외부 키 의존 |
| 메모리 | thedotmack/claude-mem | agentmemory | Windows 네이티브 설치 단순. 유료 사인인은 `--provider`로 회피 |
| 코드 리뷰 | alibaba/open-code-review | - | delegation 모드로 API 키 없이 결정론적 파일 선택·룰 매칭 |
| 2차 의견 | openai/codex-plugin-cc + google-gemini/gemini-cli | - | 서로 다른 모델. 모드 codex/gemini/both |
| 토큰 절감 | rtk-ai/rtk (+caveman 토글) | headroom | Rust 단일 바이너리, Windows 훅 네이티브 |
| 스킬 품질 | NVIDIA/SkillEvaluator + one-skill-to-rule-them-all | - | CI 검증과 세션 관찰이라는 다른 역할 |
| 스킬 보안 | NVIDIA/SkillSpector | - | 외부 스킬 설치 게이트 |
| 앱 보안 | usestrix/strix (선택) | - | Docker + LLM 키 필요. 웹/API 프로젝트 옵션 |
| 디자인 | pbakaus/impeccable | taste-skill, hallmark, 공식 frontend-design | 23 커맨드 + 61 검출 룰. 나머지는 부분집합 |
| 다이어그램 | tt-a1i/archify | diagram-design | JSON IR 결정론적 컴파일, 소스 검증, delta 비교 |
| 브라우저 QA | ChromeDevTools/chrome-devtools-mcp | - | 단독 |
| 문서 조회 | Context7 MCP | - | 버전별 공식 문서. 별도 에이전트 아님 |
| PDF | Typst 기본, LaTeX 옵션 | - | 단일 바이너리, CJK 네이티브, 명확한 에러. LaTeX은 설치된 머신에서만 |
| 이미지 | gemini-web 스킬 이식 | - | mac은 Chrome 쿠키, Windows는 GEMINI_API_KEY 폴백 |
| 리서치 | last30days-skill, Agent-Reach, gh search | firecrawl/web-agent | web-agent는 4월 이후 정지 |
| 팀 생성 | revfactory/harness (옵션) | - | 프로젝트별 추가 에이전트 팀 생성 |
| 자격증명 | CredStore (자체) | - | 값 미저장 카탈로그. 별도 플러그인으로 포장 |

**공식 Anthropic 플러그인**은 번들하지 않고 setup이 설치를 권장한다. 대상: skill-creator, plugin-dev, hookify, mcp-server-dev, claude-security, security-guidance, code-simplifier, 스택별 LSP(typescript-lsp, jdtls-lsp, kotlin-lsp 등). 공식 스킬 중 docx/pptx/xlsx/pdf(읽기), webapp-testing을 참조한다. commerce-agents는 도메인 레퍼런스 앱이므로 제외. superpowers는 게이트가 이중으로 걸리므로 제외하고 원칙만 흡수한다.

## 4. 저장소 구조

```
Nereus/
├── .claude-plugin/marketplace.json     # nereus, credstore 두 항목
├── plugins/
│   ├── nereus/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── agents/                     # 10개 (.md)
│   │   ├── skills/
│   │   │   ├── common/                 # 공통 규칙 (에이전트가 참조)
│   │   │   ├── intake/  spec/  build/  review/  finish/
│   │   │   ├── baton/  e2e/  pdf/  image/  research/  seo/
│   │   ├── commands/                   # setup, handoff, resume, loop, pdf, image
│   │   ├── hooks/hooks.json
│   │   ├── hooks/scripts/*.mjs         # Node 전용
│   │   ├── .mcp.json                   # context7, chrome-devtools
│   │   └── README.md
│   └── credstore/
│       ├── .claude-plugin/plugin.json
│       ├── .mcp.json                   # npx credstore mcp
│       └── commands/
├── docs/specs/
├── tests/                              # vitest, macOS·Windows CI
└── package.json                        # 개발 전용. 런타임 의존성 0
```

결정:
- 플러그인 런타임은 Node 20+ 표준 라이브러리만. 사용자 `npm install` 불필요.
- CredStore 소스는 기존 저장소에 두고 npm으로 배포. 여기는 MCP 등록과 커맨드만.
- 설치: `/plugin marketplace add snwlee/Nereus` → `/plugin install nereus@nereus`, `/plugin install credstore@nereus`.

## 5. 워크플로와 게이트

```
intake ──▶ spec ──▶ build ──▶ [e2e] ──▶ review ──▶ finish
```

**intake.** Architect가 ouroboros interview 진행. 게이트: 모호성 ≤ 0.2. `--quick`은 인터뷰 생략, spec은 거침.

**spec.** 프로젝트 상태 자동 판별.
- 신규(소스 없음, 또는 `openspec/`·`.specify/` 없고 커밋 < 10): spec-kit constitution → specify → plan → tasks.
- 기존: OpenSpec. 최초 onboard, 이후 propose → apply.
- 게이트: tasks에 체크박스와 완료 조건. 핵심 사용자 흐름은 `[flow]` 태그.

**build.** TDD 규칙.
- TDD 가능 환경 판별: 테스트 러너 존재·실행 가능. Flutter `flutter test`, Spring `gradlew test`/`mvn test`, TS/JS test 스크립트 또는 vitest/jest 설정.
- 가능하면 TDD 강제: 실패 테스트 → 실패 확인 → 최소 구현 → 통과 → 리팩터. `tdd-guard` 훅이 테스트 선행 기록 없는 소스 편집에 경고 주입. 차단은 안 함. 설정·마이그레이션 등은 제외 패턴.
- 러너 없으면 세팅을 한 번 제안. 스택이 셋 중 하나면 기본 세팅 제공. 거절 시 handoff.md에 "테스트 없음" 기록.
- 게이트: 태스크 테스트 전부 통과 + ouroboros evaluate Mechanical 통과.

**e2e.** QA가 `[flow]` 태스크만 대상으로 실행. 웹 Playwright, Flutter integration_test + Patrol, Spring REST Assured + Testcontainers. 2회 재시도 후 실패면 차단. 간헐 실패는 quarantine 목록 + handoff 기록. 삭제 금지.

**review.** Reviewer가 OCR delegation과 2차 의견(설정: codex/gemini/both)을 병렬 실행. 게이트: CRITICAL·HIGH 0. Security는 인증·입력·외부 호출 변경에 자동 투입.

**finish.** conventional commit, OpenSpec archive, tasks 체크, handoff.md 갱신, claude-mem 요약. 브랜치 정리는 사용자에게 질문.

개입 지점: 어느 단계든 `ooo unstuck`. 컨텍스트 65%면 Baton이 현재 단계 마무리 후 handoff.

## 6. 에이전트 계약

파일 형식: frontmatter `name, description(트리거 명시), model, tools(허용 목록)`. 본문: 역할 3줄 → 필수 스킬 → 금지 → 출력 계약 → 완료 조건.

| 에이전트 | 트리거 | 도구·스킬 | 출력 |
|---|---|---|---|
| architect | intake, spec | ouroboros, spec-kit/OpenSpec, archify, Context7 | 스펙·계획·다이어그램 |
| backend | Spring/Node 서버 코드 | codegraph, LSP, Context7, e2e(API) | 코드 + 테스트 |
| frontend | 웹 UI | impeccable, chrome-devtools, Playwright | 코드 + 스크린샷 검증 |
| app | Flutter/Dart | LSP, Context7, e2e(Patrol) | 코드 + 테스트 |
| researcher | 시장·기술 조사 | WebSearch, last30days, Agent-Reach, gh search, pdf | `docs/research/*.md` + PDF |
| seo | SEO 감사·키워드 | researcher 도구 + 감사 체크리스트 | 감사 보고서 |
| reviewer | review 단계 | OCR delegation, codex, gemini | 심각도별 findings |
| security | 인증·입력·외부호출 변경 | SkillSpector, strix(옵션), credstore | findings + 차단 여부 |
| qa | `[flow]` 태스크, review 직전 | e2e, webapp-testing, ouroboros evaluate | 통과/실패 + quarantine |
| writer | finish, 문서 요청 | archify, pdf, ADR 템플릿, OpenSpec archive | 문서 |

규칙:
- 에이전트는 서로 직접 호출하지 않는다. 오케스트레이션은 워크플로 스킬.
- 공통 규칙(응답 언어, 불변성, 검증 전 완료 선언 금지, 시크릿은 `creds_run`)은 `skills/common/`에 한 번만 두고 참조.
- 개발 에이전트는 처음 쓰는 라이브러리나 메이저 버전이 바뀐 API 앞에서 Context7을 확인한다.
- 프로젝트별 추가 팀은 revfactory/harness로 `.claude/agents/`에 생성. 하네스 10개는 불변.

## 7. 훅과 크로스플랫폼

| 훅 | 스크립트 | 동작 |
|---|---|---|
| SessionStart | session-start.mjs | handoff.md 주입, codegraph 확인, 외부 도구 상태 한 줄 |
| UserPromptSubmit | intake-router.mjs | 새 작업 요청 감지 시 intake 안내 |
| PostToolUse (Edit/Write) | tdd-guard.mjs | 테스트 선행 없는 소스 편집 경고, 포맷터 실행 |
| PostToolUse (전체) | baton-meter.mjs | usage 측정, 65% 경고, 80% 하드 스톱 |
| PreCompact | baton-backup.mjs | handoff.md 강제 작성 |
| Stop | finish-check.mjs | 미커밋 변경·미갱신 handoff 알림 |
| SessionEnd | session-end.mjs | claude-mem 요약 위임 |

크로스플랫폼:
- 훅 명령은 전부 `node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/x.mjs"`. bash 없음.
- `path.join`, `os.homedir()`. 설정 디렉터리 mac `~/.config/nereus`, Windows `%APPDATA%\nereus`.
- 외부 CLI는 `spawn(shell:false)`. Windows `.cmd` 해석은 스크립트가 처리.
- 훅 스크립트는 vitest 단위 테스트. CI는 macOS·Windows 러너.

## 8. setup과 설정

`/nereus:setup`:
1. Node, git, 스택 도구(flutter, java, npm) 감지.
2. 외부 도구 상태표. 필수(codegraph, claude-mem, ouroboros, OCR, spec-kit, OpenSpec, Typst, Gemini CLI, Codex)와 선택(strix, LaTeX, impeccable 라이브 모드) 구분.
3. 없는 것은 플랫폼별 설치 명령 표시, 승인 시 실행. 공식 플러그인은 `/plugin install` 안내.
4. Context7, chrome-devtools MCP는 `.mcp.json`으로 자동 등록.
5. `config.json` 생성: 2차 의견 모드, Baton 임계값, TDD 제외 패턴, PDF 엔진, 이미지 백엔드.

설정 우선순위: 프로젝트 `.nereus/config.json` > 사용자 전역. 하네스 업데이트 `/plugin update nereus`. 외부 도구는 `setup --check`가 버전만 보고.

## 9. Baton: 컨텍스트 핸드오프

**상태 파일** `.nereus/handoff.md`. 고정 섹션: 목표 / 현재 단계 / 완료 / 진행 중 / 다음 / 실패한 접근과 이유 / 결정 / 열린 질문 / 테스트 상태. 매번 전체를 다시 쓴다. 이력은 git.

**측정** baton-meter.mjs가 transcript JSONL 마지막 assistant usage의 입력 토큰 합을 모델 컨텍스트 한도로 나눈다. 모델별 표, 미상은 200k.

**단계**
- 65%: "현재 태스크만 마무리, handoff.md 작성 후 정지" 주입.
- 80%: 차단 메시지, handoff 작성만 허용.
- PreCompact: 자동 압축이 먼저 오면 백업 작성.

**재개** SessionStart가 handoff.md 주입. claude-mem은 배경 기억, handoff.md는 정확한 상태.

**reset 루프** `/nereus:loop "작업" --max 30`. loop-runner.mjs가 `claude -p`를 반복 호출. 각 반복은 handoff.md, tasks.md, 스펙만 읽고 시작하며 끝나면 커밋. 종료: tasks 전부 체크 + evaluate 통과, 또는 max 도달, 또는 같은 태스크 3회 연속 실패(unstuck 후 사람에게 인계).

## 10. PDF와 이미지

**PDF** `skills/pdf/`. 기본 Typst, `--engine latex`는 XeLaTeX + kotex 템플릿. 템플릿: 기술 보고서, ADR, 리서치 리포트, 스펙 문서. Researcher와 Writer의 최종 산출물 형식. 한글 폰트는 설정에서 지정, 기본 Noto Sans KR.

**이미지** `skills/image/`. gemini-web 스크립트 이식. 플랫폼 분기: macOS는 Chrome 쿠키 자동 갱신, Windows는 Chrome App-Bound Encryption 때문에 `GEMINI_API_KEY` 폴백, 키 없으면 쿠키 수동 입력 안내. 워터마크 처리 스크립트 포함. MCP로 만들지 않는다.

## 11. CredStore 플러그인

기존 CredStore는 값을 저장하지 않는 카탈로그 + 마스킹 실행기. 볼트로 확장하지 않는다(모델이 값을 읽는 경로가 생긴다). 하네스 통합에 필요한 변경:
1. npm 패키지 빌드, `npx credstore mcp`로 기동. 절대 경로 제거.
2. Windows 경로(`%APPDATA%\credstore`, `.env` 탐지 경로).
3. (후순위) `kind: keychain` 추가로 macOS Keychain / Windows Credential Manager 값을 `creds_run`이 주입.

## 12. 테스트 전략

- 훅 스크립트, 설정 로더, baton-meter 계산, TDD 환경 판별, 플랫폼 분기: vitest 단위 테스트. 커버리지 80% 이상.
- setup 커맨드: 도구 감지를 가짜 PATH로 테스트.
- E2E: 샘플 프로젝트 셋(Flutter, Spring, TS)에서 intake → finish 한 사이클을 CI에서 `claude -p`로 돌리는 스모크 테스트. 외부 도구는 스텁.
- 하네스 자체 스킬은 SkillEvaluator Tier 1(validate, security-scan)을 CI 게이트로.

## 13. 범위 밖

- 팀 공유 기능(OpenSpec Stores 등). 개인 하네스가 목적.
- 외부 도구 자체의 버그 수정. 상류에 기여한다.
- 커머스 등 도메인 레퍼런스 앱.
