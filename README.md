# JARVIS

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)
![License](https://img.shields.io/badge/License-Portfolio-orange?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-In%20Development-yellow?style=for-the-badge)

> *"Just A Rather Very Intelligent System."*

A terminal-based, natural-language agentic AI assistant — you talk to it in plain English, not memorized commands. JARVIS decides which tool to use (read a file, search the project, look up GitHub, search the web) through real function-calling, not a command parser pretending to be smart. Runs entirely local: your own machine, your own SQLite database, your own API keys.

Built by **Abdallah Khatib** — Computer Science graduate, Lebanese International University, reusing hard-earned patterns from [Rakiz](https://github.com/Abdallah-khatib-7/rakiz).

---

## Table of Contents

- [About](#about)
- [Key Features](#-key-features)
- [Tech Stack](#️-tech-stack)
- [Architecture Decisions](#architecture-decisions-worth-knowing)
- [Project Structure](#-project-structure)
- [Database Schema](#️-sqlite-schema)
- [Running Locally](#-running-locally)
- [Build Progress](#-build-progress)
- [Known Limitations](#known-limitations--honest-caveats)
- [About the Author](#-about)

---

## About

Most "AI terminal tools" are really just a chat window bolted onto a shell. JARVIS is built the other way around: the agentic loop *is* the product. You describe what you want, the model decides which tool answers that — reading a file, searching the project tree, checking a GitHub PR, searching the web — runs it, and reasons over the real result. Nothing is hardcoded to a specific phrase or command shape.

It's local-first by design. No hosted backend, no multi-tenant server, no central database — each person runs their own copy, with their own SQLite file, their own API keys, their own JARVIS. The tradeoff is deliberate: no hosting bill, no "your data on our servers," and every user's JARVIS is genuinely theirs.

The build has been intentionally incremental — foundation before flow, data layer before UI, one working piece before the next — with a real personality layered in from the start rather than bolted on at the end.

---

## ✨ Key Features

### 🖥️ Cinematic Terminal Identity
- Boot sequence with a glitch-resolve title animation — ASCII art assembles out of scrambled noise, not a static print
- Staggered boot-status lines (`CORE ONLINE`, `MEMORY LINKED`...) with a typewriter tagline reveal
- Every JARVIS response types out character-by-character in cyan — except code blocks, which print instantly and untouched so formatting never breaks

### 🔐 Local Identity & Accounts
- New-user / returning-user flow with back-navigation and a global `exit` escape hatch at any prompt
- bcrypt-hashed passwords (cost factor 12), local SQLite, WAL mode
- Password confirmation on signup, capped wrong-password attempts on login

### 🧠 Smart, Age-Aware Onboarding
- Freeform Q&A seeds JARVIS's memory of you: name, gender, age, role, education, self-description, favorite dessert
- Age-inference: under 18, JARVIS *guesses* you're in high school and asks you to confirm rather than interrogating cold; 18+ gets asked plainly, since it's genuinely ambiguous
- Hard age gate at 16 — invalid input gets one warning ("I am JARVIS, you can't fool me"), a second bad answer triggers a real animated self-destruct countdown; under-16 gets a respectful farewell with a quote. Both paths cleanly delete the account and its memory, no orphaned rows

### 🎭 Selectable Personality
- Four distinct voices — Cool & cinematic (Iron Man's JARVIS), Warm & witty, Playful & cheeky, Serious & professional — defined once in a shared registry and used everywhere
- First greeting always speaks in the default cinematic voice; the user picks their preferred tone right after, no wasted regeneration calls
- The chosen personality is injected into every system prompt for the rest of every session, not just the welcome message

### 🤖 Real Agentic Tool Use
- Provider-agnostic AI adapter layer — the app talks to one internal interface, never directly to a vendor SDK, so adding Claude/Gemini/DeepSeek later is a new adapter file, not a rewrite
- OpenAI function-calling wired up as a genuine multi-turn loop: model calls a tool → result feeds back into context → model calls another tool or answers in text → bounded by a hard turn ceiling with a graceful no-tools fallback if it's ever hit
- Tools ship as `{ ok, output }` results, dispatched through one central registry — adding a tool is one array entry plus one switch case

### 🛠️ Tools Available Today
| Tool | What it does |
|---|---|
| `read_file` | Reads a file, returns content with real line numbers prefixed so JARVIS can reference exact lines instead of guessing |
| `list_directory` | Lists a folder's contents, directories marked with a trailing `/` |
| `search_files` | Recursively searches the whole project by filename, skips `node_modules`/`.git`/`dist` — so JARVIS finds files himself instead of being told the path |
| `web_search` | Live web search via Serper — free tier, no card required |
| `github_search` / `github_list_repos` / `github_get_pr` / `github_get_issue` | Read-only GitHub lookups across your repos |
| `github_create_issue` / `github_comment` | Writes to GitHub, gated behind an on-screen preview panel before anything posts |

### 💬 Persistent Chat Loop
- Not a one-shot script — a genuine ongoing conversation with running history, so JARVIS remembers what you said three messages ago
- Every reply speaks in your chosen personality and is aware of everything from onboarding, injected fresh into the system prompt each session
- Thinking spinner with rotating phrases ("Studying you," "Tinkering," "Connecting the dots") covers any tool-use latency instead of a silent hang

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js 18+ / TypeScript 5 | Runtime and type safety, ES modules throughout |
| tsx | Zero-build dev execution + watch mode |
| better-sqlite3 | Local, synchronous, single-file database — WAL mode |
| bcrypt | Password hashing, cost factor 12 |
| openai | Primary AI provider SDK, wrapped behind an internal adapter interface |
| Inquirer.js | All interactive terminal prompts (text, password, select, confirm) |
| Chalk | Terminal color throughout |
| Ora | Live "thinking" spinner during AI calls and tool use |
| Figlet / Gradient-string / ansi-escapes | Boot sequence — ASCII title, color gradient, frame-by-frame glitch redraw |
| dotenv | Local `.env` key loading — never committed |
| @octokit/rest | GitHub connector |
| Serper | Web search — free tier, no card required |

---

## Architecture decisions worth knowing

- **Provider adapter, not a vendor SDK call.** Every AI call goes through `AIProvider` — one shared interface (`chat(messages) → string`). `openai.ts` is the only file that knows OpenAI's actual request shape; the rest of the app is provider-blind. Adding a second provider later means one new adapter file translating the same interface, never touching the tools, the chat loop, or the personality system.

- **Tools are pure functions, dispatched centrally.** Every tool returns `{ ok, output }` and never throws past its own boundary — a missing file becomes a readable message, not a stack trace. `registry.ts` is the single place that maps an AI-requested tool name to the real function that runs it. The AI only ever sees a name, a description, and a parameter schema; it never touches real code directly.

- **Memory is key/value, not fixed columns.** Onboarding facts, personality choice, anything JARVIS learns about a user — all stored as `(user_id, key, value)` rows with an upsert on conflict. Adding a new fact the app cares about is zero schema changes, ever.

- **Destructive actions are architecturally separate from read actions.** Reading, searching, and listing require no confirmation. Anything that would modify or delete — file edits, file deletion — is scoped from day one to require a typed confirm-phrase that echoes the specific action back, never a password re-prompt. This boundary is enforced by which functions exist, not by a runtime check that could be bypassed.

- **Local-only, by design, not by limitation.** No server, no shared auth, no multi-tenant anything. `jarvis.db` lives next to the source, resolved via a fixed path derived from the module's own location — not the caller's working directory — so the database is always found in the same place regardless of how the process was launched.

- **Age-gate deletion is transactional.** Removing an under-16 or repeatedly-invalid-age account wipes both the `users` row and every `memory` row tied to it inside a single `better-sqlite3` transaction — either both succeed or neither does. No orphaned memory rows pointing at a user that no longer exists.

---

## 📁 Project Structure

```
jarvis/
├── src/
│   ├── ai/
│   │   ├── types.ts              AIProvider interface, ChatMessage, ToolCall — the shared contract
│   │   ├── openai.ts             OpenAI adapter — the only file that speaks OpenAI's real shape
│   │   └── personality.ts        The 4 voices, single source of truth for tone everywhere
│   ├── auth/
│   │   ├── login.ts              Signup/login flow, back-navigation, session shape
│   │   ├── onboarding.ts         Age-aware Q&A, education branching, age gate
│   │   ├── effects.ts            Self-destruct countdown, underage farewell animations
│   │   ├── welcome.ts            First AI-generated personalized greeting
│   │   ├── personalityPicker.ts  Post-welcome tone selection, saved to memory
│   │   └── prompts.ts            Shared Inquirer wrappers — every prompt honors exit/back
│   ├── chat/
│   │   └── loop.ts               The ongoing conversation loop — real session, not one-shot
│   ├── connectors/
│   │   └── github.ts             GitHub tools — search, PRs, issues, comments (confirm-gated writes)
│   ├── database/
│   │   ├── db.ts                 SQLite connection, WAL mode, users table
│   │   ├── users.ts              User CRUD — create, verify, delete (transactional)
│   │   └── memory.ts             Key/value fact store per user
│   ├── tools/
│   │   ├── fileTools.ts          read_file, list_directory, search_files
│   │   ├── webSearch.ts          Serper-backed web search tool
│   │   └── registry.ts           Tool definitions + central dispatch
│   ├── ui/
│   │   ├── thinking.ts           Reusable spinner wrapper for any async work
│   │   └── reveal.ts             Typewriter speech reveal, code-block-aware
│   ├── boot.ts                   Glitch-resolve title animation, boot-status lines
│   └── index.ts                  Entry point — boot → auth → onboarding → chat loop
├── PROGRESS.md                   Living phase tracker
├── JARVIS-BRIEF.md                Full project spec and architectural ground rules
├── tsconfig.json
└── package.json
```

---

## 🗄️ SQLite Schema

| Table | Purpose |
|---|---|
| `users` | Accounts — username, bcrypt password hash, created_at |
| `memory` | Per-user key/value facts (onboarding answers, chosen personality, anything learned later) — unique per `(user_id, key)`, upserted on conflict |

Small by design — the schema grows exactly as fast as the features that need it, never ahead of them.

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- An OpenAI API key
- A GitHub personal access token (`repo` scope) — optional, only needed for the GitHub connector
- A Serper API key — optional, only needed for web search

### 1. Clone and install
```bash
git clone https://github.com/Abdallah-khatib-7/Jarvis.git
cd jarvis
npm install
```

### 2. Environment
Create a `.env` file at the project root:
```
OPENAI_API_KEY=sk-your-key-here
GITHUB_TOKEN=ghp-your-token-here
SERPER_API_KEY=your-serper-key-here
```
`.env` is gitignored — never committed, never leaves your machine.

### 3. Run
```bash
npm run dev        # run once via tsx
npm run dev:watch  # auto-restart on save
npm run build       # compile to dist/
npm start           # run the compiled build
```

First launch creates `jarvis.db` automatically next to the source — nothing to seed by hand.

---

## 📊 Build Progress

**Complete**
- Full project setup — TypeScript, build pipeline, GitHub-connected from the first file
- Terminal shell + identity — boot sequence, signup/login, onboarding, memory seeding
- AI foundation — provider adapter, OpenAI wired up, personality system, agentic tool-calling loop
- Persistent chat loop with typewriter reveal and thinking spinner
- GitHub connector (read + confirm-gated write)
- Web search via Serper

**In progress / next**
- Real execution capability (running `tsc`, shell commands) — needed for JARVIS to *verify* things, not just read and guess
- `edit_file` / `delete_file`, gated behind a typed confirm-phrase
- Per-user connector credentials (GitHub token is currently install-wide, not per-account)
- Broader memory — facts learned mid-conversation, not just at onboarding
- Multi-provider support (Claude, Gemini, DeepSeek adapters)
- Telegram and Gmail connectors
- Image input
- Voice (stretch)

Full phase-by-phase detail lives in `PROGRESS.md`.

---

## Known limitations / honest caveats

- **GitHub token is shared, not per-user.** In a multi-account local install, every user currently pulls the same `GITHUB_TOKEN` from `.env`. This needs to move to a per-session or `keytar`-backed per-user credential before it's genuinely multi-user safe — flagged, not yet fixed.
- **No execution tools yet.** JARVIS can read and reason about code but can't run it — "does this file have errors" gets an honest best-effort read-through, not a real compiler answer, until `tsc`/shell execution tools exist.
- **No file-write tools yet.** `edit_file` and `delete_file` are scoped and designed (confirm-phrase gated) but not built — JARVIS is currently read-only on your filesystem.
- **Single AI provider.** Only OpenAI is wired up today; the adapter layer is built to make adding others straightforward, but Claude/Gemini/DeepSeek don't exist yet.
- **No shared-key token cap enforcement yet.** The 75k/day shared-key model is specified but not implemented — today, every local user with the shared `.env` key has unlimited use.

---

## 👨‍💻 About

I'm Abdallah Khatib, a Computer Science graduate from Lebanese International University 🇱🇧, with 5+ years of pharmacy experience prior to this. JARVIS is a from-scratch build — terminal, database, AI orchestration, and personality — following the same no-shortcuts approach as [Rakiz](https://github.com/Abdallah-khatib-7/rakiz), my multi-currency wallet and payments platform.

📧 abdallah.khatib2003@gmail.com

---

## 📄 License

This project is for portfolio and demonstration purposes. All rights reserved © 2026 Abdallah Khatib.