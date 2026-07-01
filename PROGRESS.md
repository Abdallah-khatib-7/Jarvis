# JARVIS — Progress Tracker

A living map of what's built and what's left. We tick boxes as we go.

---

## Setup
- [x] Base folder created
- [x] `package.json`
- [x] `.gitignore`
- [x] Git repo + first commit
- [x] GitHub remote connected + pushed
- [x] `PROGRESS.md` (this file) pushed
- [x] TypeScript installed + configured
- [x] Folder structure (`src/`)

---

## Phase 1 — Terminal shell + identity
- [x] Animated boot sequence (glitch-in title, boot-status lines, typewriter tagline)
- [x] New-user vs returning-user flow (with back navigation + exit anywhere)
- [x] Account creation / login (local SQLite, bcrypt-hashed passwords)
- [x] Onboarding Q&A that seeds initial memory (age-aware education branching,
      age-gate with self-destruct sequence for invalid input, polite farewell
      + account deletion for under-16)

## Phase 2 — Core agentic loop
- [x] AI provider interface + OpenAI adapter (`src/ai/types.ts`, `src/ai/openai.ts`)
- [x] Function-calling wired up — real multi-turn tool use loop, `MAX_TURNS` cap,
      graceful no-tools fallback when the cap is hit
- [x] `read_file` tool
- [x] `list_directory` tool
- [x] `search_files` tool (recursive project search, skips node_modules/.git/dist)
- [x] Live status spinner UI (`withThinking`, rotating phrases)
- [x] Ongoing chat loop (`src/chat/loop.ts`) — persistent conversation, not one-shot
- [~] `read_file` line-numbering fix — in progress, verify it landed
- [ ] Real execution capability (run `tsc`, run shell commands) — next real milestone

## Phase 3 — Destructive file ops
- [ ] `edit_file` (behind confirm-phrase)
- [ ] `delete_file` (behind confirm-phrase)

## Phase 4 — Image input
- [ ] Image as input type in the loop

## Phase 5 — Memory system
- [x] Persistent structured facts (`src/database/memory.ts`, key/value per user)
- [x] Fed into context each session (onboarding facts + personality inform every prompt)
- [ ] Broader memory beyond onboarding (facts learned mid-conversation)

## Phase 6 — Personality + discoverability
- [x] System prompt voice (4 selectable personalities: cinematic, warm, playful,
      professional — `src/ai/personality.ts`, chosen post-welcome, used app-wide)
- [x] Typewriter speech reveal (`src/ui/reveal.ts`) — code blocks print instantly
      and untouched, prose types out
- [ ] `jarvis help` (categorized)
- [ ] First-run tour
- [ ] Contextual hints
- [ ] Easter eggs

## Phase 7 — Connectors
- [ ] GitHub (`@octokit/rest`)
- [ ] Telegram
- [ ] Gmail (OAuth2)

## Phase 8 — Multi-provider support
- [ ] Provider picker
- [ ] Adapter layer (Claude / Gemini / DeepSeek — OpenAI adapter already
      built as the template)
- [ ] Shared-key daily token cap (75k/day)

## Phase 9 — Voice (stretch)
- [ ] Whisper STT
- [ ] OpenAI TTS

---

## Notes / new ideas
- Admin/dev DB tools: list users, delete a user, dump a user's memory.
  Likely a hidden `jarvis admin` command or dev-only script. Useful for
  testing and cleanup. (Came up while removing test accounts.)
- Execution tools (tsc, shell) are the next real milestone — needed for
  JARVIS to answer questions like "do I have errors in this file" instead
  of just reading and guessing. Read-only execution = no confirm-phrase
  needed. Anything that modifies files/system = same confirm-phrase gate
  as edit_file/delete_file.