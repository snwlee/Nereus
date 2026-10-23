# nereus

개인 개발 하네스. intake → spec → build(TDD) → e2e → review → finish 워크플로를 훅으로 강제하고, 전문가 에이전트 10개를 제공한다. 컨텍스트는 Claude Code 자동 압축(50%)과 PreCompact 요약 지시가 맡는다. macOS·Windows 공용 (훅은 전부 Node).

## 설치

```
/plugin marketplace add snwlee/Nereus
/plugin install nereus@nereus
/nereus:setup
```

## 구성

- `hooks/` SessionStart(학습 규칙·스킬 맵 주입, 루프 반복에서만 handoff 주입), PostToolUse(tdd-guard), PreCompact(압축 요약 다섯 섹션 지시)
- `skills/` setup, common, intake, spec, build, review, finish, baton, e2e, pdf, image, research, seo
- `agents/` architect, backend, frontend, app, researcher, seo, reviewer, security, qa, writer
- 커맨드는 별도 디렉터리 없이 스킬 이름으로 호출 (`/nereus:setup`, `/nereus:intake`, `/nereus:loop` 등)

설계 문서: `docs/specs/2026-09-05-nereus-harness-design.md`
