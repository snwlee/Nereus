# Nereus

snwlee의 개인 Claude Code 하네스 마켓플레이스. macOS·Windows 공용.

| 플러그인 | 역할 |
|---|---|
| `nereus` | intake → spec → build(TDD) → e2e → review → finish 워크플로, 전문가 에이전트 10개, Node 훅, Baton 컨텍스트 핸드오프, PDF/이미지/리서치 스킬 |
| `credstore` | 자격 증명 메타데이터 카탈로그 MCP ([소스](https://github.com/snwlee/CredStore)) |

## 설치

```
/plugin marketplace add snwlee/Nereus
/plugin install nereus@nereus
/nereus:setup
```

`setup`이 외부 도구(codegraph, ouroboros, Open Code Review, spec-kit, OpenSpec, Typst, Antigravity(agy)/Codex CLI 등) 설치 상태를 표로 보여주고 승인된 것만 설치한다. 외부 도구는 이 저장소에 포함되지 않고 래퍼로 호출된다.

## 워크플로

```
intake ──▶ spec ──▶ build ──▶ [e2e] ──▶ review ──▶ finish
 모호성≤0.2  tasks    TDD+qa   [flow]만   CRIT/HIGH 0  커밋·archive
```

- 테스트 러너가 있으면 TDD를 강제한다(`tdd-guard` 훅이 경고, 차단은 안 함).
- 컨텍스트 65%에서 현재 태스크만 마무리하고 `.nereus/handoff.md`로 넘긴다. 80%는 하드 스톱. 새 세션은 `/nereus:resume`.
- 장기 자율 작업은 `/nereus:loop` (반복마다 새 세션, 상태는 파일과 git에만).

## 설정

`~/.config/nereus/config.json` (Windows `%APPDATA%\nereus\config.json`), 프로젝트별 `.nereus/config.json`이 덮어씀.

| 키 | 기본 | 의미 |
|---|---|---|
| `secondOpinion` | `both` | review 2차 의견: `codex` / `gemini` / `both` |
| `baton.warn` / `baton.hard` | `0.65` / `0.8` | 컨텍스트 경고 / 하드 스톱 비율 |
| `tdd.exclude` | 마이그레이션·설정·생성 파일 | TDD 경고 제외 glob |
| `pdf.engine` / `pdf.font` | `typst` / `Noto Sans KR` | PDF 엔진(`latex` 가능)과 한글 폰트 |
| `image.backend` | `auto` | `web`(로그인 세션) / `api`(GEMINI_API_KEY) |

## 개발

```
npm ci && npm test        # vitest, macOS·Windows CI
claude plugin validate .  # 매니페스트 검증
```

설계: `docs/specs/2026-09-05-nereus-harness-design.md`
