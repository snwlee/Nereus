---
name: setup
description: 외부 도구 감지·설치, 동반 플러그인 안내, 설정 파일 생성. /nereus:setup [--check]
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
  "baton": { "warn": 0.5, "hard": 0.7 },
  "tdd": { "exclude": ["**/migrations/**", "**/*.config.*", "**/*.d.ts", "**/generated/**", "**/*.g.dart", "**/*.freezed.dart"] },
  "pdf": { "engine": "typst", "font": "Noto Sans KR" },
  "image": { "backend": "auto" }
}
```

각 키의 의미를 한 줄씩 설명하고 바꿀 것이 있는지 묻는다.

도구 호출 차단 규칙은 별도 파일이다. 기본 규칙(`--no-verify`, 루트 재귀 삭제, force push, 작업 폐기 git 명령, 시크릿 파일 편집)은 플러그인에 내장되어 있고, 사용자 규칙은 같은 디렉터리의 `rules.json`, 프로젝트 규칙은 `.nereus/rules.json`에 둔다. 형식은 `[{ "id", "tools": ["Bash"], "pattern": "<regex>", "message": "<되돌릴 문구>", "enabled": true }]`. 같은 id를 다시 쓰면 기본 규칙을 덮어쓰거나 `"enabled": false`로 끌 수 있다. 잘못된 regex는 무시된다(fail-open). 프로젝트별로 다르게 하려면 `.nereus/config.json`에 같은 형식으로 둔다.

## 5. statusline 연동 (Baton 기준 일치)

Claude Code가 statusline에 넘기는 공식 `context_window.used_percentage`를 Baton이 그대로 쓰게 한다. 사용자의 statusline 스크립트(`~/.claude/settings.json`의 `statusLine.command`)에 아래 한 줄을 추가한다. 없으면 이 줄만 실행하는 스크립트를 만들어 등록한다.

```bash
printf '%s' "$input" | node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/ctx-sink.mjs" >/dev/null 2>&1 &
```
(`$input`은 statusline이 stdin으로 받은 JSON을 담은 변수명에 맞춘다. Windows PowerShell은 `$input | node ... ctx-sink.mjs`.) 연동이 없으면 Baton은 transcript 기반 추정치로 동작한다.

같은 statusline에 Nereus 상태 한 줄(`⚓ 3/7 · 미검증 · 54%`)을 붙이려면 아래도 추가한다. 사용자가 원할 때만.

```bash
sid=$(printf '%s' "$input" | jq -r '.session_id // empty')
node "${CLAUDE_PLUGIN_ROOT}/skills/hud/scripts/hud.mjs" --session "$sid"
```

## 6. 자동 압축 임계값

Baton(50% 경고 / 70% 하드 스톱)이 Claude Code 자동 압축보다 먼저 작동해야 한다. 자동 압축은 손실 요약이라 마지막 안전망으로만 둔다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scripts/autocompact.mjs"            # 현재 값
node "${CLAUDE_PLUGIN_ROOT}/skills/setup/scripts/autocompact.mjs" --set 80   # 권장값
```

현재 값을 보여주고 80으로 설정할지 묻는다. 승인하면 실행한다. `~/.claude/settings.json`의 `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`에 쓰고 변경 전 파일을 백업한다. Claude Code 내부 상한이 약 83%라 그 위 값은 자동으로 조정된다. 새 세션부터 적용된다.

## 7. 마무리

무엇을 설치했고 무엇이 남았는지 표로 요약한다. 남은 필수 도구가 있으면 어떤 워크플로 단계가 영향을 받는지 알려준다 (예: `ooo` 없음 → intake 인터뷰 불가, `ocr` 없음 → review는 2차 의견만).
