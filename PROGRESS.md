# JARVIS — Build Progress

## ✅ Completed

### Core (Phases 1–3)
- Multi-user terminal login with bcrypt passwords stored in SQLite
- Animated JARVIS boot screen (figlet + gradient)
- Box-drawing panel UI system (consistent across all features)
- Long-term memory: key/value facts per user, persisted in SQLite
- Personality system: 4 voice modes (cinematic, warm, playful, professional)
- Animated typewriter speech output with ANSI-safe rendering

### Agentic Loop (Phase 5)
- OpenAI function-calling loop (up to 10 tool rounds per turn)
- Claude agentic loop (tool_use / tool_result blocks, Anthropic format)
- Tools: `read_file`, `list_directory`, `search_files`, `grep_files`,
  `execute_command`, `edit_file`, `create_file`, `delete_file`
- Code-block-aware file reveal

### Multi-Provider AI (Phase 8)
- Claude adapter (sonnet-4-6) with full tool-use support
- OpenAI adapter (gpt-4o-mini) with function-calling
- Auto-selection: Claude first if `ANTHROPIC_API_KEY` present, OpenAI fallback
- Per-user provider preference stored in memory (`ai_provider` fact)
- `/provider` slash command to switch live

### GitHub Connector (Phase 7)
- Per-user token stored in OS credential store (keytar)
- 12 tools: `github_search`, `github_list_repos`, `github_get_repo`,
  `github_get_file`, `github_get_pr`, `github_get_issue`,
  `github_create_issue`, `github_comment`, `github_create_pr`,
  `github_list_runs`, `github_trigger_workflow`, `github_disconnect`
- Write operations show preview panel + confirm before executing
- CI run icons: ✓ / ✗ / ⟳ / ◌ / ⊘

### Telegram Connector (Phase 7)
- Per-user token + chat ID stored in keytar (or session-only)
- Validated via `getMe` on setup; chat ID from `@userinfobot`
- Tools: `telegram_connect`, `telegram_send`, `telegram_send_file`, `telegram_disconnect`

### Gmail Connector (Phase 7)
- Per-user App Password stored in keytar (or session-only)
- Verified via IMAP on setup
- Tools: `gmail_connect`, `gmail_send`, `gmail_inbox`, `gmail_search`,
  `gmail_read`, `gmail_disconnect`
- Send shows full email preview panel + confirm before sending
- Pre-send: asks for `full_name`, `job_title`, `company` if missing from memory

### Web Search
- `web_search` — Google results via Serper (answer box, knowledge graph, organic)
- `web_news` — Google News via Serper
- System prompt enforces mandatory search for prices, versions, availability
- `/search` and `/news` slash commands with inline query prompt

### Reminders
- `remind_me(message, delay_minutes)` — schedule a reminder
- `list_reminders` — see pending reminders with time remaining
- `cancel_reminder(id)` — cancel by ID
- Fires: terminal bell + yellow alert panel + Telegram message (if connected)
- Natural language parsed by AI: "in 30 minutes", "in 2 hours"
- `/reminders` slash command

### UX & Design (Phase 6)
- First-run animated tour (5 sections, shown once on first login)
- Slash command menu (`/` key) with arrow-key navigation
- 17 commands: `/help`, `/memory`, `/clear`, `/status`, `/provider`,
  `/personality`, `/connect`, `/disconnect`, `/inbox`, `/repos`, `/prs`,
  `/issues`, `/reminders`, `/search`, `/news`, `/tour`, `/exit`
- Full markdown rendering: bold, inline code, links, H1/H2/H3,
  bullet lists (◆), numbered lists, fenced code blocks with styled box
- ANSI-safe typewriter (skips escape sequences, never splits color codes)
- User prompt arrow: red — JARVIS reply: blue
- Startup label: `JARVIS_zeusModal-1.02`

---

## 📋 Remaining

### Phase 4 — Image Input
- Attach a screenshot or image path; JARVIS analyzes it
- Requires Vision API: Claude (claude-3-5-sonnet) or OpenAI (gpt-4o)
- Needs base64 encoding + multimodal message format for both providers

### Phase 8 Remainder — Daily Token Cap
- 75 000 token/day limit per user on shared API keys
- Track usage in SQLite; block or warn when limit approached

### Phase 9 — Voice (Stretch Goal)
- STT: Whisper API — speak to JARVIS instead of typing
- TTS: OpenAI TTS or ElevenLabs — JARVIS speaks replies aloud
