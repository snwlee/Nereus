# nereus

개인 개발 하네스. intake → spec → build(TDD) → e2e → review → finish 워크플로를 훅으로 강제하고, 전문가 에이전트 10개와 Baton 컨텍스트 핸드오프를 제공한다. macOS·Windows 공용 (훅은 전부 Node).

## 설치

```
/plugin marketplace add snwlee/Nereus
/plugin install nereus@nereus
/nereus:setup
```

## 구성

- `hooks/` SessionStart(handoff 주입), PostToolUse(baton-meter 65/80%, tdd-guard)
- `skills/` setup, common, intake, spec, build, review, finish, baton, e2e, pdf, image, research, seo
- `agents/` architect, backend, frontend, app, researcher, seo, reviewer, security, qa, writer
- `commands/` setup, intake, spec, build, review, finish, handoff, resume, loop, pdf, image

설계 문서: `docs/specs/2026-09-05-nereus-harness-design.md`
