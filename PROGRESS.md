# JARVIS — Build Progress

## ✅ Completed

### Core
- Multi-user terminal login with bcrypt passwords stored in SQLite
- Animated boot sequence: procedural arc-reactor power-up → figlet glitch-title reveal → system status checks → typewriter tagline
- Shared HUD toolkit (`src/ui/hud.ts`) — boxed panels, brand gradient, ANSI-safe centering — used consistently across boot, login, onboarding, and chat
- Long-term memory: key/value facts per user, persisted in SQLite
- Personality system: 4 voice modes (cinematic, warm, playful, professional), picked at signup with a themed "CALIBRATE VOICE" panel
- Animated typewriter speech output with full markdown rendering (bold, inline code, links, headers, bullet/numbered lists, fenced code blocks), ANSI-safe

### Onboarding & Login
- HUD-styled login screen ("JARVIS ACCESS TERMINAL" header, boxed ACCESS GRANTED / ACCESS DENIED / NEW PROFILE panels)
- 7-question onboarding dossier with step badges (`◈ step N of 7`), age-aware education branching, playful fail-safes (self-destruct sequence for fake ages, respectful farewell for under-16)
- AI-generated in-character welcome greeting on first login

### Agentic Loop
- OpenAI function-calling loop and Claude tool_use/tool_result loop (up to 10 tool rounds per turn)
- Auto-provider selection: Claude first if `ANTHROPIC_API_KEY` present, OpenAI fallback; `/provider` to switch live
- 38 tools across file ops, memory, GitHub, Telegram, Gmail, web search, and reminders (see `src/tools/registry.ts`)

### Connectors
- **GitHub** — 12 tools: search, repos, files, PRs, issues, comments, create issue/PR, Actions runs, workflow dispatch. Token in OS credential store. Writes show a preview panel + confirm.
- **Telegram** — connect, send text/HTML, send file, disconnect. Token + chat ID in keytar.
- **Gmail** — connect (App Password via IMAP), send, inbox, search, read, disconnect. Composed emails render real markdown bold/italic as HTML (not literal `**asterisks**`) in both the terminal preview and the sent email.
- **Web search** — Google results + Google News via Serper, mandatory before answering anything time-sensitive.

### Voice Mode (`/voice`)
- Fully free, fully offline — no paid APIs, no accounts
- Push-to-talk: records mic via a bundled ffmpeg binary, transcribes locally with Whisper (`Xenova/whisper-base.en`, ONNX, ~150MB one-time download, cached in `.voice-cache/`)
- Transcription runs in an isolated child process with a 90s timeout, so a native-runtime hang can never freeze the app
- Replies spoken back with a free Microsoft Edge neural voice (`en-GB-RyanNeural`), played via Windows' built-in SoundPlayer

### Screen Awareness (`/screen`)
- Captures the full desktop (multi-monitor aware) via Windows' built-in `System.Drawing`, no extra dependencies
- Feeds the screenshot through the same vision pipeline as `/attach` so the AI actually looks at it

### File Attachments (`/attach`)
- Native Windows file picker for images, PDFs, Word docs, and code/text files
- Images go multimodal to the vision API; PDFs/DOCX get text-extracted; code/text sent as context

### Proactive Systems
- **CEO briefing** — once-per-day-on-launch digest pulling from Gmail (unread), GitHub (Octokit), reminders, and system info; `/brief` to re-run on demand
- **System watchdog** — silent background monitor for CPU/RAM/disk thresholds with cooldown-gated alerts
- **Reminders** — natural-language delay parsing, fires via terminal alert + Telegram (if connected), persisted across restarts

### Usage & Limits
- Daily token cap: 150,000 tokens/user/day with a 90% usage warning, Claude-Code-style limit UI; admin account (`test`) exempt

### UX & Design
- Slash command menu (`/` key, arrow-key navigation) — 32 commands total, including easter eggs
- Visual easter eggs: `/hack`, `/tony`, `/coffee`, `/tea`, `/matrix`, `/selfdestruct`
- First-run animated tour (6 sections, shown once)

---

## 💡 Ideas / Not Started
- Calendar integration (conflict-aware reminders, "what's on my calendar")
- Inbox triage autopilot — flag what needs a reply, draft responses for approval
- Cross-tool event triggers ("new PR review request → Telegram ping")
- `/stats` — personal usage dashboard (token trends, most-used commands)
- Wake-word always-listening voice mode (current `/voice` is push-to-talk by design — fully free, no background mic)
