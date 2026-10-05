---
name: codex-independent-reviewer
description: "The Codex app (OpenAI) is the user's independent second-opinion reviewer; keep it isolated from Claude"
metadata:
  node_type: memory
  type: project
  originSessionId: c6acdd7b-ce7b-43de-b6da-d78b30e60080
  modified: 2026-10-05T19:24:32.198Z
---

The user uses the OpenAI Codex desktop app solely for independent second-opinion reviews (`/review` → "Review uncommitted changes" in a fresh thread). It must not be a Claude model or anything similarly trained, so a Claude subagent is not an option.

**Why:** they want a review uncontaminated by Claude's reasoning. On 2026-10-03 to 2026-10-05 we found Codex had imported Claude Code sessions, skills, the global CLAUDE.md and a repo hook. We turned off `external-agent-import-sync-enabled` in `~/.codex/config.toml`, deleted the HumanLens Codex chats and removed the copies in `~/.agents/skills/` (commit, push, synced, .trash) and the repo `.codex/hooks.json` (commit 3d643f4). `~/.codex/AGENTS.md` (an old copy of the global CLAUDE.md) was deliberately kept. On 2026-10-05 we deleted the three imported Claude HumanLens transcripts still in `~/.codex/sessions/`, plus the user's three archived Oct 1 Codex setup chats for HumanLens, and turned Codex memories off in `config.toml` (`[features] memories = false`, `[memories]` generate/use = false; backup at `config.toml.bak-claude`).

**How to apply:** don't reintroduce Claude material where Codex reads it (`~/.agents/skills/`, `.codex/`). Leave work uncommitted for review; when the user pastes Codex findings back, assess each one honestly. Don't run paid Codex reviews unprompted (see [[no-auto-real-model-eval]]).
