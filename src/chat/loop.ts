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
import { runBriefing, shouldShowBriefing } from "../ui/briefing.js";
import { startWatchdog } from "../tools/watchdog.js";
import { speak } from "../voice/index.js";
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


const ADMIN_USERNAMES = ["test"];

function isAdmin(session: Session): boolean {
  return ADMIN_USERNAMES.includes(session.username.toLowerCase());
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
    `Use your tools aggressively — never guess when you can act.`,
    ``,
    `SEARCH RULE — call web_search or web_news BEFORE answering (no exceptions):`,
    `  Prices, current versions, specs, availability, news, anything that could have changed since 2024.`,
    `  Never tell the user to search themselves — you search and report.`,
    ``,
    `Files: always read_file before edit_file so old_string matches exactly. Act immediately, don't explain.`,
    ``,
    `Memory: proactively remember preferences, tech stack, project context, personal details.`,
    `  Priority keys: full_name, job_title, company, phone_number.`,
    `  Use recall mid-conversation for latest facts. Switch provider: remember("ai_provider","claude"|"openai").`,
    ``,
    `GitHub: use github_get_file for remote repo files (NOT read_file). Trigger auth via github_list_repos.`,
    `  Store github_username in memory. Search hint: is:pr is:open author:@me`,
    ``,
    `Telegram: NEVER ask user to type token into chat — call telegram_connect. HTML: <b>bold</b> <code>code</code>.`,
    ``,
    `Reminders: parse natural language ("30 min"→30, "2 hours"→120). User picks delivery at creation.`,
    `  No connectors (no Telegram, no Gmail) → tell user to /connect first.`,
    ``,
    `Gmail: before composing, check memory for full_name, job_title, company, phone_number.`,
    `  NEVER leave placeholder text like [Your Name] — use real values or ask.`,
    `  NEVER ask user to type App Password into chat — call gmail_connect.`,
    ``,
    `Images: analyze thoroughly, diagnose errors/UI issues, suggest fixes. Act on what you see.`,
    ``,
    `Style: short replies. Panels and diffs speak for themselves. Never break character.`,
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

  // Start system watchdog (silent background monitor)
  startWatchdog(session);

  // Show first-run tour once
  if (isFirstRun(session)) {
    await runTour(session);
  }

  // Morning briefing — once per day on startup
  if (shouldShowBriefing(session.id)) {
    await runBriefing(session);
  }

  while (true) {
    const input = await askRaw(PROMPT_ARROW + " ");
    if (!input) continue;

    /* refresh system message so facts stored mid-session are always current */
    conversation[0] = { role: "system", content: buildSystemPrompt(session) };

    let speakReply = false;

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
      speakReply = result.speak === true;
    } else {
      conversation.push({ role: "user", content: input });
    }

    // ── token cap check ───────────────────────────────────────────────────────
    const used = getDailyTokens(session.id);
    if (!isAdmin(session)) {
      if (used >= DAILY_LIMIT) {
        showLimitReached(used);
        continue;
      }
      if (used / DAILY_LIMIT >= WARN_AT) {
        showUsageWarning(used);
      }
    }

    const provider = resolveProvider(session);
    const reply = await withThinking(
      () => provider.chat(conversation),
      "Thinking"
    );

    addTokens(session.id, provider.lastTokensUsed, provider.name);

    conversation.push({ role: "assistant", content: reply });

    // Keep history bounded: system prompt (index 0) + last 20 messages
    const MAX_HISTORY = 20;
    if (conversation.length > MAX_HISTORY + 1) {
      conversation.splice(1, conversation.length - 1 - MAX_HISTORY);
    }

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

    if (speakReply) {
      try {
        await speak(reply);
      } catch {
        console.log(chalk.dim("  (voice reply failed — showing text only)"));
      }
    }

    // Dim token line after each response so the user can see per-message cost
    const totalNow = getDailyTokens(session.id);
    const limitLabel = isAdmin(session) ? "∞" : fmt(DAILY_LIMIT);
    process.stdout.write(
      chalk.dim(`  [+${fmt(provider.lastTokensUsed)} tokens · ${fmt(totalNow)} / ${limitLabel} today]\n`)
    );
  }
}
