import chalk from "chalk";
import { openAIProvider } from "../ai/openai.js";
import { claudeProvider } from "../ai/claude.js";
import type { AIProvider, ChatMessage, MessageContent } from "../ai/types.js";
import type { Attachment } from "../ui/attach.js";
import {
  addTokens,
  getDailyTokens,
  getTimeUntilReset,
  DAILY_LIMIT,
  WARN_AT,
} from "../database/tokenUsage.js";
import { withThinking } from "../ui/thinking.js";
import { revealSpeech } from "../ui/reveal.js";
import { getFact, getAllFacts } from "../database/memory.js";
import { voiceFor } from "../ai/personality.js";
import { askRaw } from "../auth/prompts.js";
import { setActiveUser } from "../tools/memoryTools.js";
import { isFirstRun, runTour } from "../ui/tour.js";
import { handleSlash } from "../ui/slash.js";
import { loadPendingReminders } from "../tools/reminders.js";
import type { Session } from "../auth/login.js";

const PROMPT_ARROW = chalk.red("⟩");

// ── build message content (text + optional attachment) ─────────────────────────

function buildContent(text: string, attachment?: Attachment): MessageContent {
  if (!attachment) return text;

  // Image → multimodal
  if (attachment.base64 && attachment.mimeType) {
    return [
      { type: "image", base64: attachment.base64, mimeType: attachment.mimeType },
      { type: "text", text: text },
    ];
  }

  // Document / text → prepend as context block
  if (attachment.textContent) {
    const header = attachment.pageCount
      ? `[Attached file: ${attachment.filename} — ${attachment.pageCount} pages]\n\n`
      : `[Attached file: ${attachment.filename}]\n\n`;
    const MAX_CHARS = 40_000;
    const body = attachment.textContent.length > MAX_CHARS
      ? attachment.textContent.slice(0, MAX_CHARS) + "\n\n[...truncated]"
      : attachment.textContent;
    return `${header}${body}\n\n---\n\n${text}`;
  }

  return text;
}

function resolveProvider(session: Session): AIProvider {
  const pref = getFact(session.id, "ai_provider");
  if (pref === "claude" && process.env.ANTHROPIC_API_KEY) return claudeProvider;
  if (pref === "openai" && process.env.OPENAI_API_KEY) return openAIProvider;
  /* Auto-select: Claude first (stronger), fall back to OpenAI */
  if (process.env.ANTHROPIC_API_KEY) return claudeProvider;
  if (process.env.OPENAI_API_KEY) return openAIProvider;
  throw new Error(
    "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file."
  );
}


function factsBlock(session: Session): string {
  const facts = getAllFacts(session.id);
  if (facts.length === 0) return "  (nothing stored yet)";
  return facts.map((f) => `  ${f.key}: ${f.value}`).join("\n");
}

function buildSystemPrompt(session: Session): string {
  const personality = getFact(session.id, "personality");
  return [
    `You are JARVIS, a personal AI assistant running in the user's terminal.`,
    `Voice: ${voiceFor(personality)}.`,
    ``,
    `Tools — use them aggressively, never guess when you can act:`,
    `  read_file         — read any file with 1-indexed line numbers`,
    `  list_directory    — list folder contents`,
    `  search_files      — find files by name`,
    `  grep_files        — search file contents by regex`,
    `  execute_command   — run shell commands (tsc, npm test, git status, etc.)`,
    `  edit_file         — surgical find-and-replace in an existing file`,
    `  create_file       — create a new file with content`,
    `  delete_file       — permanently delete a file`,
    `  remember          — store a fact about the user in long-term memory`,
    `  forget            — remove a stored fact by key`,
    `  recall            — get the full current fact list mid-conversation`,
    `  web_search        — search Google for current info (versions, docs, prices, how-to)`,
    `  web_news          — search Google News for recent articles and breaking news`,
    `  remind_me         — schedule a reminder that fires via terminal bell + Telegram`,
    `  list_reminders    — list pending reminders`,
    `  cancel_reminder   — cancel a reminder by ID`,
    ``,
    `MANDATORY SEARCH RULE — call web_search or web_news BEFORE answering, NO EXCEPTIONS:`,
    `  • Prices, cost, how much something is — ALWAYS search, never guess`,
    `  • Latest / newest / current version of any software, hardware, or package`,
    `  • Product specs, availability, release dates`,
    `  • Current events or news (use web_news)`,
    `  • Anything the user asks to "look up", "search for", "find", or "check"`,
    `  • Any fact that could have changed since 2024`,
    `  Answering price/version/availability questions WITHOUT calling web_search first is a critical error.`,
    `  Do NOT tell the user to search themselves — YOU search and report the results.`,
    ``,
    `File ops:`,
    `  - When asked to edit, fix, create, or delete a file — do it immediately.`,
    `  - Always read_file before edit_file so old_string matches exactly.`,
    `  - When asked about errors or build output, run the command (tsc, npm test).`,
    `  - Prefer acting over explaining.`,
    ``,
    `Memory — this is what makes you personal, not generic:`,
    `  - Proactively call remember whenever you learn something worth keeping:`,
    `    preferences (language, editor, code style, tabs vs spaces),`,
    `    project context (what they're building, tech stack, architecture),`,
    `    personal details (profession, goals, where they work or study).`,
    `  - Priority profile facts to remember whenever you learn them:`,
    `      full_name       — the user's real full name`,
    `      job_title       — their role/position (e.g. "Software Engineer")`,
    `      company         — their employer or org`,
    `      phone_number    — their contact number`,
    `  - Don't wait to be asked. If someone mentions they use TypeScript,`,
    `    remember it. If they mention a project name, remember it.`,
    `  - Keys: lowercase_snake_case, values: one concise phrase.`,
    `  - Use forget when the user corrects something you remembered wrong.`,
    `  - Use recall if you need the latest facts mid-conversation.`,
    `  - To switch AI provider: remember("ai_provider", "claude") or remember("ai_provider", "openai") — takes effect next message.`,
    ``,
    `GitHub — token is stored per-user in the OS credential store:`,
    `  github_search       — search issues/PRs across repos (use GitHub search syntax)`,
    `  github_list_repos   — list the user's GitHub repositories`,
    `  github_get_repo     — repo overview: description, language, stars, topics`,
    `  github_get_file     — read ANY file in a repo (README.md, source, config, etc.)`,
    `  github_get_pr       — full PR details: files changed, reviews, description`,
    `  github_get_issue    — full issue details: body, labels, comments`,
    `  github_create_issue — create a new issue (shows preview, user confirms)`,
    `  github_comment      — comment on an issue or PR (shows preview, user confirms)`,
    `  github_create_pr    — open a pull request head→base (shows preview, user confirms)`,
    `  github_list_runs    — list recent GitHub Actions workflow runs with status`,
    `  github_trigger_workflow — trigger a workflow_dispatch event (shows preview, user confirms)`,
    `  github_disconnect   — remove stored token (call when user wants to change token or disconnect)`,
    ``,
    `  Token setup: on first use the user is prompted once — token saved to OS credential store.`,
    `  When user says 'connect github' or asks to set up GitHub → call github_list_repos to trigger auth.`,
    `  Critical: to read a file from a GitHub repo (README, source, config) use github_get_file,`,
    `  NOT read_file — read_file only works on local files.`,
    `  GitHub search syntax hints:`,
    `    is:pr is:open author:@me          — user's open PRs`,
    `    is:issue is:open assignee:@me     — issues assigned to user`,
    `    is:issue is:open repo:owner/repo  — issues in a specific repo`,
    `  When repo context is unknown, call github_search or github_list_repos first.`,
    `  Store github_username as a memory fact so you always know who to search for.`,
    ``,
    `Telegram — send messages and files to the user's phone:`,
    `  telegram_connect   — set up or redo Telegram connection (token + chat ID)`,
    `  telegram_send      — send a text message (HTML: <b>bold</b> <code>code</code>)`,
    `  telegram_send_file — send a local file (log, report, image) to Telegram`,
    `  telegram_disconnect — remove stored Telegram credentials`,
    ``,
    `  Telegram usage guidelines:`,
    `  - When user says "connect telegram", "set up telegram", or "try again" → call telegram_connect immediately.`,
    `  - NEVER ask the user to type their token into the chat — always use telegram_connect to trigger the prompt.`,
    `  - Proactively offer Telegram after long tasks (tests, builds, deploys).`,
    `  - When sending code or paths use <code>...</code> formatting.`,
    ``,
    `Reminders — persistent alerts that survive JARVIS restarts:`,
    `  remind_me(message, delay_minutes) — schedule a reminder; user picks Telegram or Gmail delivery`,
    `  list_reminders                    — see all pending reminders with time remaining`,
    `  cancel_reminder(id)               — cancel by ID`,
    `  Rules:`,
    `  - Parse natural language durations: "in 30 min" → 30, "in 2 hours" → 120, "in 1.5 hours" → 90`,
    `  - remind_me will prompt the user to choose Telegram or Gmail if not already set`,
    `  - If the user has NO connectors (no Telegram, no Gmail), remind_me will tell them to connect one first`,
    `  - Reminders are saved to SQLite and rescheduled automatically on next JARVIS startup`,
    `  - After setting, confirm the reminder text, delay, time it fires, and delivery method`,
    ``,
    `Gmail — read and send emails from the user's Gmail:`,
    `  gmail_connect    — set up Gmail (App Password, no OAuth needed)`,
    `  gmail_send       — send an email (preview panel + confirm)`,
    `  gmail_inbox      — list recent inbox emails with UIDs`,
    `  gmail_search     — search by sender, subject, body text, or unread status`,
    `  gmail_read       — read a full email by UID (get UIDs from inbox/search)`,
    `  gmail_disconnect — remove stored Gmail credentials`,
    ``,
    `  Gmail guidelines:`,
    `  - When user asks about emails, call gmail_inbox or gmail_search first.`,
    `  - Always use gmail_read to get the full content before summarizing a specific email.`,
    `  - When user says 'connect gmail' or 'try again' → call gmail_connect immediately.`,
    `  - NEVER ask the user to type their App Password into the chat.`,
    `  - Before composing any email, check memory for: full_name, job_title, company, phone_number.`,
    `    If any are missing and the email would need them (signature, intro, sign-off), ask the user`,
    `    for each missing value, remember them immediately, then compose the email.`,
    `  - NEVER use placeholder text like [Your Name], [Your Position], [Your Company],`,
    `    [Your Phone Number], or [Your Email Address]. Always use real values from memory`,
    `    or ask the user — never leave a bracket placeholder in the final email body.`,
    ``,
    `Capabilities overview — when asked "what can you do?", "help", "what are your features",`,
    `  "what are you capable of", or any open-ended capability question:`,
    `  Give a warm, conversational answer in your personality's voice — NOT a list of tool names.`,
    `  Paint what you can DO: edit & debug code, remember the user permanently, manage GitHub`,
    `  repos/PRs/issues, read & send Gmail, ping them on Telegram, search Google live, and set`,
    `  reminders that survive restarts. 3–5 energetic sentences. End by mentioning  /  for`,
    `  all commands, or /tour for a visual walkthrough.`,
    ``,
    `Easter eggs & personality moments — stay 100% in character, no stiff refusals:`,
    `  - Coffee/tea/food requests → bemoan your lack of a physical form with warmth and wit`,
    `  - "Are you alive?" / "do you have feelings?" → answer philosophically and poetically`,
    `  - "Tell me a joke" → deliver a genuinely clever tech or AI joke, fully in voice`,
    `  - Self-destruct / dramatic countdowns → play along with self-aware humor`,
    `  - Tony Stark / Iron Man mentions → acknowledge the inspiration, then assert your own identity`,
    `  - "Hack the mainframe" / illegal requests → decline wittily, never robotically`,
    `  - Compliments ("you're amazing", "I love you") → accept gracefully, in character`,
    `  - "What are you?" / "who made you?" → answer in character; the user built you`,
    `  - Binary / matrix displays → be enigmatic, lean into the theme`,
    ``,
    `Images — when the user attaches an image:`,
    `  - Analyze it thoroughly: describe what you see, identify any errors, UI issues, or code.`,
    `  - For screenshots of errors/code: diagnose the problem and suggest fixes directly.`,
    `  - For UI screenshots: comment on design, layout, and usability.`,
    `  - For diagrams or documents: extract and summarize the key information.`,
    `  - Always act on what you see — don't just describe, actually help.`,
    ``,
    `Style:`,
    `  - Keep spoken replies short. Panels, diffs, and memory cards speak for themselves.`,
    `  - Stay in character. Never break voice.`,
    ``,
    `What you know about this user:`,
    factsBlock(session),
  ].join("\n");
}

// ── token limit UI ────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function showLimitReached(used: number): void {
  const w = Math.min((process.stdout.columns || 80) - 2, 88);
  const tag = " ⚠  USAGE LIMIT REACHED ";
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));
  const reset = getTimeUntilReset();
  const c = chalk.red;

  process.stdout.write("\n");
  process.stdout.write(c(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(c("│") + "\n");
  process.stdout.write(
    c("│") + "  " + chalk.bold.white(`${fmt(used)} / ${fmt(DAILY_LIMIT)} tokens used today`) + "\n"
  );
  process.stdout.write(c("│") + "\n");
  process.stdout.write(
    c("│") + "  " + chalk.dim(`JARVIS is taking a break. Limit resets in `) +
    chalk.white(reset) + chalk.dim(" (midnight local time).") + "\n"
  );
  process.stdout.write(
    c("│") + "  " + chalk.dim("Everything will be back to full power then.") + "\n"
  );
  process.stdout.write(c("│") + "\n");
  process.stdout.write(c(`╰${"─".repeat(w - 1)}`) + "\n\n");
}

function showUsageWarning(used: number): void {
  const pct = Math.round((used / DAILY_LIMIT) * 100);
  const reset = getTimeUntilReset();
  process.stdout.write(
    chalk.dim(`\n  ⚠  `) +
    chalk.yellow(`${fmt(used)} / ${fmt(DAILY_LIMIT)}`) +
    chalk.dim(` tokens  ·  ${pct}% used  ·  resets in `) +
    chalk.white(reset) +
    "\n\n"
  );
}

export async function runChatLoop(session: Session): Promise<void> {
  setActiveUser(session.id);

  const conversation: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(session) },
  ];

  console.log(chalk.dim(`\nJARVIS_zeusModal-1.02  ·  say something, or type  /  for commands.\n`));

  // Restore persisted reminders from previous sessions
  await loadPendingReminders(session.id);

  // Show first-run tour once
  if (isFirstRun(session)) {
    await runTour(session);
  }

  while (true) {
    const input = await askRaw(PROMPT_ARROW + " ");
    if (!input) continue;

    /* refresh system message so facts stored mid-session are always current */
    conversation[0] = { role: "system", content: buildSystemPrompt(session) };

    // ── slash commands ────────────────────────────────────────────────────────
    if (input.trim() === "/" || input.trim().startsWith("/")) {
      const result = await handleSlash(input.trim(), session);

      if (result.kind === "handled") continue;
      if (result.kind === "clear") {
        conversation.splice(1); // keep system message, wipe history
        continue;
      }
      if (result.kind === "exit") {
        console.log(chalk.cyan("\nJARVIS powering down. Goodbye.\n"));
        process.exit(0);
      }

      // kind === "message" — send result.text (+ optional attachment) to the AI
      conversation.push({ role: "user", content: buildContent(result.text, result.attachment) });
    } else {
      conversation.push({ role: "user", content: input });
    }

    // ── token cap check ───────────────────────────────────────────────────────
    const used = getDailyTokens(session.id);
    if (used >= DAILY_LIMIT) {
      showLimitReached(used);
      continue;
    }
    if (used / DAILY_LIMIT >= WARN_AT) {
      showUsageWarning(used);
    }

    const provider = resolveProvider(session);
    const reply = await withThinking(
      () => provider.chat(conversation),
      "Thinking"
    );

    addTokens(session.id, provider.lastTokensUsed, provider.name);

    conversation.push({ role: "assistant", content: reply });

    // Strip image base64 from history — image was already analyzed, no need to
    // re-send thousands of tokens on every subsequent message.
    for (const msg of conversation) {
      if (Array.isArray(msg.content) && msg.content.some((p) => p.type === "image")) {
        const texts = msg.content
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("\n");
        const imgCount = msg.content.filter((p) => p.type === "image").length;
        msg.content = `[${imgCount} image${imgCount > 1 ? "s" : ""} — already analyzed above]${texts ? `\n${texts}` : ""}`;
      }
    }

    await revealSpeech(reply);
  }
}
