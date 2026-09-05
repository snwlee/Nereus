---
name: setup
description: Nereus 하네스 초기 설정. 외부 도구(codegraph, ouroboros, OCR, spec-kit, OpenSpec, Typst, Gemini/Codex CLI 등) 설치 상태를 표로 보여주고, 승인된 것만 설치하며, 공식 플러그인 목록을 안내하고 설정 파일을 만든다. "/nereus:setup", "하네스 설정", "도구 설치 확인", "setup --check" 요청 시 사용.
---

# Nereus setup

## 1. 감지

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scripts/detect.mjs"
```

출력된 표를 사용자에게 그대로 보여준다. `--check` 인자만 있으면 여기서 끝낸다.

## 2. 설치

- 미설치 **필수** 도구를 하나씩 나열하고 설치 여부를 묻는다. 한 번에 전부 승인받아도 된다.
- 승인된 명령만 실행한다. 표의 명령이 `winget`/`brew`/`npm`/`uv`이면 그대로 실행하고, URL 안내형이면 사용자에게 링크를 보여준다.
- 파이프 설치 스크립트(`curl ... | sh`, `irm ... | iex`)는 실행 전에 원문 URL을 한 번 더 보여주고 승인받는다.
- 선택 도구는 목록만 보여주고 묻지 않는다. 사용자가 원하면 설치한다.
- 설치 후 `detect.mjs`를 다시 실행해 결과를 확인한다. 새 터미널이 필요한 도구(codegraph 등)는 그렇게 안내한다.

## 3. 동반 플러그인 안내

아래는 Nereus가 포함하지 않고 각자 마켓플레이스에서 설치하는 것들이다. 명령만 보여주고 실행은 사용자가 한다.

- claude-mem: `/plugin marketplace add thedotmack/claude-mem` → `/plugin install claude-mem`
- ouroboros: `/plugin marketplace add Q00/ouroboros` → `/plugin install ouroboros@ouroboros`
- codex: `/plugin install codex@openai-codex`
- impeccable: `npx impeccable install` 후 `/impeccable init`
- 공식 마켓플레이스: skill-creator, plugin-dev, hookify, mcp-server-dev, claude-security, security-guidance, code-simplifier, 그리고 스택 LSP(typescript-lsp, jdtls-lsp, kotlin-lsp)
- credstore: `/plugin install credstore@nereus` (CredStore npm 게시 후 동작)

## 4. 설정 파일

사용자 전역 설정이 없으면 만든다. 위치는 macOS `~/.config/nereus/config.json`, Windows `%APPDATA%\nereus\config.json`.

```json
{
  "secondOpinion": "both",
  "baton": { "warn": 0.65, "hard": 0.8 },
  "tdd": { "exclude": ["**/migrations/**", "**/*.config.*", "**/*.d.ts", "**/generated/**", "**/*.g.dart", "**/*.freezed.dart"] },
  "pdf": { "engine": "typst", "font": "Noto Sans KR" },
  "image": { "backend": "auto" }
}
```

각 키의 의미를 한 줄씩 설명하고 바꿀 것이 있는지 묻는다. 프로젝트별로 다르게 하려면 `.nereus/config.json`에 같은 형식으로 둔다.

## 5. 마무리

무엇을 설치했고 무엇이 남았는지 표로 요약한다. 남은 필수 도구가 있으면 어떤 워크플로 단계가 영향을 받는지 알려준다 (예: `ooo` 없음 → intake 인터뷰 불가, `ocr` 없음 → review는 2차 의견만).
