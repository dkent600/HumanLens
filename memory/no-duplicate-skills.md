---
name: no-duplicate-skills
description: "Each skill exists as exactly one file in the repo — no copies, generated mirrors, or symlinks/junctions"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4db3da78-2503-4aae-aaec-b5ce8d3a71b4
  modified: 2026-10-03T18:18:33.986Z
---

Each skill must exist as exactly one file. Don't propose copies, sync scripts that generate mirrors, or symlinks/junctions to make another agent see a skill.

**Why:** The user said they "cannot tolerate duplicate skills". Copies already drifted once (two `testing-practices` versions). They also rejected links, because a fresh clone doesn't recreate them (git doesn't track junctions, and a Windows clone checks symlinks out as text files).

**How to apply:** Share a skill across agents by pointing each agent's own discovery mechanism at the single source. For Claude Code, that's a repo-local plugin/marketplace that reads `.agents/skills/` in place. Codex reads `.agents/skills/` natively.
