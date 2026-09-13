<p align="center">
  <img src="docs/assets/nereus-social-oldman.png" alt="Nereus — hold fast for the truth" width="900">
</p>

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

### Plugins

The core harness is the workflow. Domain packs add skills and one expert agent each, and are installed only if you need them — they never patch the core, they attach through a data-only `nereus-extension.json`.

| Plugin | Version | What it adds |
|---|---|---|
| `nereus` | 0.17.1 | The workflow itself: 23 skills, 10 expert agents, Node hooks, Baton handoff, setup and doctor |
| `nereus-game` | 0.3.0 | Game development: Roblox, Unity (mobile), Switch, Flutter/Flame adapters plus level, balance, narrative, sound, liveops and compliance skills |
| `nereus-ads` | 0.1.0 | AdMob operations: the policy gate that keeps an account alive, placement design, and revenue levers |
| `nereus-l10n` | 0.1.0 | Localization: source strings, store listings and ASO, plus typeface coverage — the constraint that silently breaks a whole locale |
| `nereus-3d` | 0.1.0 | three.js: incomplete `dispose`, unwired dispose helpers, missing `renderer.info` instrumentation, draw-call budgets and GPU leaks |

```
/plugin install nereus-game@nereus     # or nereus-ads, nereus-l10n, nereus-3d
/nereus:doctor                         # after installing anything, check for shadowed MCP servers and routes
```

Each pack routes narrowly on its own vocabulary. `/nereus:doctor` reports collisions; it never uninstalls anything.

## Flow

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/nereus-flow-dark.png">
    <img src="docs/assets/nereus-flow-light.png" alt="Nereus workflow: intake → spec → build → e2e → review → finish, with the Baton context handoff" width="900">
  </picture>
</p>

Each stage calls the next only when its own gate passes. Day to day you only type `/nereus:intake`.

Baton runs ahead of Claude Code's own auto-compaction (a lossy summary). At 50% of the context window it tells you to finish the current task; at 70% it stops and demands a handoff. `/nereus:setup` offers to set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` so the order is 50% warn → 70% hard stop → 80% compaction as a last resort.

<sub>Built with <a href="https://github.com/tt-a1i/archify">archify</a> (MIT) from a checked-in JSON IR, not hand-drawn: <a href="docs/diagrams/nereus-flow.workflow.json"><code>docs/diagrams/nereus-flow.workflow.json</code></a>. Regenerate with <code>archify deliver workflow docs/diagrams/nereus-flow.workflow.json out.html --quality showcase</code>.</sub>

## Commands

| Command | Purpose |
|---|---|
| `/nereus:setup` | Detect and install tools, write config, report MCP resident cost |
| `/nereus:intake [--quick]` | Interview until requirements are unambiguous |
| `/nereus:spec` | Generate spec and tasks (greenfield or brownfield, auto-detected) |
| `/nereus:build` | Implement tasks with TDD |
| `/nereus:e2e` | End-to-end checks for `[flow]` tasks |
| `/nereus:debug` | Four-phase root-cause investigation before any fix |
| `/nereus:design` | Three stages for any design/UI/UX work — generate direction candidates (ui-ux-pro-max), critique the direction, critique the render; hard gate at finish |
| `/nereus:review` | Parallel review, severity gate |
| `/nereus:finish` | Completion gate (test evidence + integrity scan + design feedback), then commit, archive, update handoff |
| `/nereus:handoff` | Save state for the next session. After `/clear` the SessionStart hook re-injects it and resumes automatically — `/nereus:resume` is only for resuming by hand (e.g. a different tasks file). |
| `/nereus:loop "goal" --max N` | Autonomous loop with a fresh session per iteration |
| `/nereus:continue on\|off` | Continue remaining tasks inside the current session (off by default, auto-disarms at the context warning) |
| `/nereus:learn` | Review and approve what the hooks observed; approved rules are injected next session |
| `/nereus:hud` | One-line status: task progress, verification state, context % |
| `/nereus:doctor` | Report conflicts with other harness plugins — shadowed MCP servers, duplicate agent or skill names, shared hook points. Reports only, never uninstalls |
| `/nereus:pdf`, `/nereus:image`, `/nereus:research`, `/nereus:seo` | Standalone skills |

## Skill routing

Compressed descriptions alone don't make the model reach for a skill, so it is planted at two points.
- **SessionStart**: a compact skill map (trigger → skill) once per fresh context.
- **UserPromptSubmit**: a regex router (`hooks/scripts/lib/router.mjs`) names the matching skill in one line, once per skill per session. No LLM call.

Process skills (`debug`, `intake`) come before implementation skills.

## Agents

Core: `architect` `backend` `frontend` `app` `researcher` `seo` `reviewer` `security` `qa` `writer`

Domain packs add one expert each: `gameplay-engineer` `level-designer` `economy-designer` `narrative-writer` `art-director` `game-ux` (game) · `ads-engineer` · `l10n-engineer` · `graphics-engineer` (3D).

Each agent is a persona, an allow-list of tools, and an output contract. Agents never call each other; the workflow skills orchestrate. Domain agents do not redefine the TDD procedure — they reuse `nereus:build`.

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
  "design": { "enforce": "block", "widths": [320, 768, 1440] },
  "commitQuality": { "block": ["secret", "env_file"], "warn": ["debug_log"] },
  "pdf": { "engine": "typst", "font": "Noto Sans KR" },
  "image": { "backend": "auto" }
}
```

`secondOpinion` picks the reviewers: `"both"` (default), `"codex"`, `"gemini"`, `"none"` (deterministic OCR pass only), or an explicit array such as `["ocr", "gemini"]`.

`design.enforce` defaults to `"block"`: touching a design surface without a Gemini critique round stops `finish`. Set it to `"warn"` if you want the warning without the gate.


## Development

```bash
npm ci && npm test
claude plugin validate .
```

Design doc: [`docs/specs/2026-09-05-nereus-harness-design.md`](docs/specs/2026-09-05-nereus-harness-design.md)

## License

[MIT](LICENSE)
