<p align="center">
  <img src="docs/assets/nereus-hero.webp" alt="Nereus" width="760">
</p>

<h1 align="center">Nereus</h1>

<p align="center"><strong>An opinionated development harness for Claude Code.</strong></p>

<p align="center">
  <a href="https://github.com/snwlee/Nereus/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/snwlee/Nereus/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Version" src="https://img.shields.io/github/v/tag/snwlee/Nereus?label=version&color=1f4e79">
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/macOS%20%7C%20Windows-lightgrey">
</p>

<p align="center"><b>English</b> · <a href="README.ko.md">한국어</a></p>

---

Interview first. Spec before code. TDD enforced by hooks. Three reviewers in parallel. Hand off before the context window fills.

## Install

```
/plugin marketplace add snwlee/Nereus
/plugin install nereus@nereus
/nereus:setup
```

Requires Node 20+ and Git. `setup` detects the external tools, installs what you approve, and writes the config file.

## Flow

```mermaid
flowchart LR
    I[intake<br/>interview] -->|ambiguity ≤ 0.2| S[spec<br/>tasks + done criteria]
    S --> B[build<br/>RED → GREEN → REFACTOR]
    B -->|tests pass| E{"[flow] tasks?"}
    E -->|yes| Q[e2e]
    E -->|no| R
    Q -->|pass| R[review<br/>OCR · Codex · Gemini]
    R -->|CRITICAL/HIGH = 0| F[finish<br/>commit · archive · handoff]
    R -->|findings| B

    subgraph Baton [Baton — context handoff]
        direction LR
        W[50% warn:<br/>finish current task] --> H[write handoff.md<br/>commit · stop]
        H --> N[/clear<br/>auto-resumes]
    end

    B -. context ≥ 50% .-> W
    N -. continues at same stage .-> B
```

Each stage calls the next when its gate passes. Day to day you only type `/nereus:intake`.

## Commands

| Command | Purpose |
|---|---|
| `/nereus:setup` | Detect and install tools, write config, report MCP resident cost |
| `/nereus:intake [--quick]` | Interview until requirements are unambiguous |
| `/nereus:spec` | Generate spec and tasks (greenfield or brownfield, auto-detected) |
| `/nereus:build` | Implement tasks with TDD |
| `/nereus:e2e` | End-to-end checks for `[flow]` tasks |
| `/nereus:debug` | Four-phase root-cause investigation before any fix |
| `/nereus:design` | Two rounds of Gemini feedback (direction, rendered result) for any design/UI/UX work; hard gate at finish |
| `/nereus:review` | Parallel review, severity gate |
| `/nereus:finish` | Completion gate (test evidence + integrity scan + design feedback), then commit, archive, update handoff |
| `/nereus:handoff` | Save state for the next session. After `/clear` the SessionStart hook re-injects it and resumes automatically — `/nereus:resume` is only for resuming by hand (e.g. a different tasks file). |
| `/nereus:loop "goal" --max N` | Autonomous loop with a fresh session per iteration |
| `/nereus:continue on\|off` | Continue remaining tasks inside the current session (off by default, auto-disarms at the context warning) |
| `/nereus:learn` | Review and approve what the hooks observed; approved rules are injected next session |
| `/nereus:hud` | One-line status: task progress, verification state, context % |
| `/nereus:pdf`, `/nereus:image`, `/nereus:research`, `/nereus:seo` | Standalone skills |

## Skill routing

Compressed descriptions alone don't make the model reach for a skill, so it is planted at two points.
- **SessionStart**: a compact skill map (trigger → skill) once per fresh context.
- **UserPromptSubmit**: a regex router (`hooks/scripts/lib/router.mjs`) names the matching skill in one line, once per skill per session. No LLM call.

Process skills (`debug`, `intake`) come before implementation skills.

## Agents

`architect` `backend` `frontend` `app` `researcher` `seo` `reviewer` `security` `qa` `writer`

Each agent is a persona, an allow-list of tools, and an output contract. Agents never call each other; the workflow skills orchestrate.

## Hooks

| Event | What it does |
|---|---|
| UserPromptSubmit | `learn-watch`: records the correction and nudges once per session |
| PreToolUse | `pre-tool-guard`: blocks commands/edits matching rules (`--no-verify`, force push, secret files). On `git commit`, blocks staged secrets and `.env`; debug logs are warnings only |
| SessionStart | Injects `handoff.md` and high-confidence learnings, reports missing tools |
| PostToolUse | `tdd-guard`: warns when source is edited before its test. `baton-meter`: 50% warn, 70% hard stop. `observe`: appends raw observations, no judgment |
| PreCompact | Demands a handoff before auto-compaction |
| Stop | Continues the next task when `/nereus:continue` is armed; otherwise flags uncommitted changes, a stale handoff, or missing/stale test evidence |

All hooks are Node scripts. No bash, zero runtime dependencies, identical on macOS and Windows.

## Config

`~/.config/nereus/config.json` (Windows: `%APPDATA%\nereus\config.json`). A project-level `.nereus/config.json` overrides it.

```json
{
  "secondOpinion": "both",
  "baton": { "warn": 0.5, "hard": 0.7 },
  "tdd": { "exclude": ["**/migrations/**", "**/*.config.*", "**/generated/**"] },
  "pdf": { "engine": "typst", "font": "Noto Sans KR" },
  "image": { "backend": "auto" }
}
```

`secondOpinion` picks the reviewers: `"both"` (default), `"codex"`, `"gemini"`, `"none"` (deterministic OCR pass only), or an explicit array such as `["ocr", "gemini"]`.


Baton runs ahead of Claude Code's own auto-compaction (a lossy summary). `/nereus:setup` offers to set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` so the order is 50% warn → 70% hard stop → 80% compaction as a last resort.

## Development

```bash
npm ci && npm test
claude plugin validate .
```

Design doc: [`docs/specs/2026-09-05-nereus-harness-design.md`](docs/specs/2026-09-05-nereus-harness-design.md)

## License

[MIT](LICENSE)
