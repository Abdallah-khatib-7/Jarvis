import inquirer from "inquirer";
import chalk from "chalk";
import keytar from "keytar";
import {
  insertReminder,
  markFired,
  deleteReminder,
  getPendingReminders,
  getReminderById,
  type ReminderRow,
} from "../database/reminders.js";
import { getFact, setFact } from "../database/memory.js";
import { getActiveUserId } from "./memoryTools.js";
import { stopThinking } from "../ui/thinking.js";
import { voiceFor } from "../ai/personality.js";
import type { ToolResult } from "./fileTools.js";
import type { ChatMessage } from "../ai/types.js";

// ── in-memory timeout handles (for cancellation) ──────────────────────────────

const _handles = new Map<number, ReturnType<typeof setTimeout>>();

// ── helpers ───────────────────────────────────────────────────────────────────

const SERVICE = "jarvis";

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0
    ? `${h} hour${h === 1 ? "" : "s"}`
    : `${h}h ${m}m`;
}

function fmtRemaining(fireAt: Date): string {
  const ms = fireAt.getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.round(ms / 60_000);
  return fmtDuration(mins);
}

// ── personality-aware message generation ─────────────────────────────────────

function personalityFallback(raw: string, personality: string, missed: boolean): string {
  switch (personality) {
    case "cinematic":
      return missed
        ? `Sir, this one slipped through while I was offline — you wanted to: ${raw}.`
        : `Sir, a gentle nudge — ${raw}.`;
    case "warm":
      return missed
        ? `Hey! Catching up on a missed one — don't forget: ${raw}!`
        : `Hey! Just a friendly reminder — ${raw}!`;
    case "playful":
      return missed
        ? `Whoops, missed this one! Past-you said: ${raw}. Get on it!`
        : `Ding ding! ${raw} — don't let me down!`;
    case "professional":
      return missed
        ? `Overdue reminder: ${raw}.`
        : `Reminder: ${raw}.`;
    default:
      return missed ? `Missed reminder: ${raw}` : raw;
  }
}

async function generateVoiceMessage(
  raw: string,
  userId: number,
  missed: boolean
): Promise<string> {
  try {
    const pref = getFact(userId, "ai_provider");
    const personality = getFact(userId, "personality") ?? "cinematic";
    const voice = voiceFor(personality);

    let provider: { chat(msgs: ChatMessage[]): Promise<string> } | null = null;

    if (pref === "claude" && process.env.ANTHROPIC_API_KEY) {
      const { claudeProvider } = await import("../ai/claude.js");
      provider = claudeProvider;
    } else if (pref === "openai" && process.env.OPENAI_API_KEY) {
      const { openAIProvider } = await import("../ai/openai.js");
      provider = openAIProvider;
    } else if (process.env.ANTHROPIC_API_KEY) {
      const { claudeProvider } = await import("../ai/claude.js");
      provider = claudeProvider;
    } else if (process.env.OPENAI_API_KEY) {
      const { openAIProvider } = await import("../ai/openai.js");
      provider = openAIProvider;
    }

    if (!provider) return personalityFallback(raw, personality, missed);

    const context = missed
      ? `This reminder fired while you were offline. Deliver it now as a missed reminder.`
      : `This reminder is firing right on time.`;

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are JARVIS. Voice: ${voice}. Deliver reminders in character — address the user directly, warmly but in your personality. Keep it to 1–2 short sentences. Never use emojis. Never repeat the word "reminder". Output ONLY the spoken message, nothing else.`,
      },
      {
        role: "user",
        content: `${context} The reminder is: "${raw}"`,
      },
    ];

    const reply = await provider.chat(messages);
    return reply.trim();
  } catch {
    const personality = getFact(userId, "personality") ?? "cinematic";
    return personalityFallback(raw, personality, missed);
  }
}

// ── fire a reminder ───────────────────────────────────────────────────────────

async function fireReminder(row: ReminderRow, missed = false): Promise<void> {
  markFired(row.id);
  _handles.delete(row.id);

  // Ring the bell immediately so the user notices
  process.stdout.write("\x07");

  // Generate the personality-aware spoken message
  const spoken = await generateVoiceMessage(row.message, row.user_id, missed);

  // ── terminal panel ─────────────────────────────────────────────────────────
  const w = termWidth();
  const tag = missed ? " ⏰ MISSED REMINDER " : " ⏰ REMINDER ";
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));
  const maxW = w - 6;

  process.stdout.write("\n");
  process.stdout.write(chalk.yellow(`╭─${tag}${fill}`) + "\n");

  // Word-wrap the spoken message inside the panel
  const words = spoken.split(" ");
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxW && line) {
      process.stdout.write(chalk.yellow("│") + "  " + chalk.white(line) + "\n");
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) process.stdout.write(chalk.yellow("│") + "  " + chalk.white(line) + "\n");

  process.stdout.write(chalk.yellow(`╰${"─".repeat(w - 1)}`) + "\n\n");

  // ── deliver ────────────────────────────────────────────────────────────────
  if (row.delivery === "telegram") {
    try {
      const { telegramSendTool } = await import("../connectors/telegram.js");
      await telegramSendTool(spoken);
    } catch {
      process.stdout.write(chalk.dim("  (Telegram not reachable — terminal alert only)\n\n"));
    }
  } else if (row.delivery === "gmail" && row.gmail_to) {
    try {
      const gmailRaw = await keytar.getPassword(SERVICE, `gmail-${row.user_id}`);
      if (gmailRaw) {
        const { email, password } = JSON.parse(gmailRaw) as { email: string; password: string };
        const { sendEmailDirect } = await import("../connectors/gmail.js");
        const subject = missed ? `⏰ JARVIS — Missed Reminder` : `⏰ JARVIS — Reminder`;
        await sendEmailDirect(email, password, row.gmail_to, subject, spoken);
      }
    } catch {
      process.stdout.write(chalk.dim("  (Gmail not reachable — terminal alert only)\n\n"));
    }
  }
}

// ── schedule a DB row as a timeout ────────────────────────────────────────────

function scheduleRow(row: ReminderRow, msLeft: number): void {
  const handle = setTimeout(() => {
    fireReminder(row).catch(() => {});
  }, msLeft);
  if (typeof handle === "object" && handle !== null && "unref" in handle) {
    (handle as { unref(): void }).unref();
  }
  _handles.set(row.id, handle);
}

// ── startup: load persisted reminders ────────────────────────────────────────

export async function loadPendingReminders(userId: number): Promise<void> {
  const rows = getPendingReminders(userId);
  if (rows.length === 0) return;

  const now = Date.now();
  for (const row of rows) {
    const fireAt = new Date(row.fire_at);
    const msLeft = fireAt.getTime() - now;

    if (msLeft <= 0) {
      await fireReminder(row, true);
    } else {
      scheduleRow(row, msLeft);
    }
  }
}

// ── check what connectors the user has ───────────────────────────────────────

async function checkConnectors(
  userId: number
): Promise<{ hasTelegram: boolean; hasGmail: boolean; gmailAddress: string | null }> {
  const [tg, gm] = await Promise.all([
    keytar.getPassword(SERVICE, `telegram-${userId}`),
    keytar.getPassword(SERVICE, `gmail-${userId}`),
  ]);

  let gmailAddress: string | null = null;
  if (gm) {
    try {
      gmailAddress = (JSON.parse(gm) as { email: string }).email;
    } catch {
      gmailAddress = null;
    }
  }

  return { hasTelegram: !!tg, hasGmail: !!gm, gmailAddress };
}

// ── pick delivery method (interactive if needed) ──────────────────────────────

async function resolveDelivery(
  userId: number
): Promise<{ delivery: "telegram" | "gmail"; gmailTo: string | null } | null> {
  const { hasTelegram, hasGmail, gmailAddress } = await checkConnectors(userId);

  if (!hasTelegram && !hasGmail) return null;

  // Check stored preference
  const pref = getFact(userId, "reminder_delivery");
  if (pref === "telegram" && hasTelegram) return { delivery: "telegram", gmailTo: null };
  if (pref === "gmail" && hasGmail) return { delivery: "gmail", gmailTo: gmailAddress };

  stopThinking();

  let delivery: "telegram" | "gmail";

  if (hasTelegram && hasGmail) {
    const { choice } = await inquirer.prompt<{ choice: "telegram" | "gmail" }>([
      {
        type: "select",
        name: "choice",
        message: "Send reminders via:",
        choices: [
          { name: "Telegram  — message to your phone", value: "telegram" },
          { name: "Gmail     — email to your inbox", value: "gmail" },
        ],
      },
    ]);
    delivery = choice;
  } else {
    delivery = hasTelegram ? "telegram" : "gmail";
    console.log(chalk.dim(`\n  Using ${delivery} for reminders.\n`));
  }

  const { remember } = await inquirer.prompt<{ remember: boolean }>([
    {
      type: "confirm",
      name: "remember",
      message: `Always use ${delivery} for future reminders?`,
      default: true,
    },
  ]);

  if (remember) setFact(userId, "reminder_delivery", delivery);

  return {
    delivery,
    gmailTo: delivery === "gmail" ? gmailAddress : null,
  };
}

// ── tools ─────────────────────────────────────────────────────────────────────

export async function setReminderTool(
  message: string,
  delayMinutes: number
): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  if (!Number.isFinite(delayMinutes) || delayMinutes < 1 || delayMinutes > 1440) {
    return { ok: false, output: "Delay must be between 1 minute and 24 hours." };
  }

  const resolved = await resolveDelivery(userId);

  if (!resolved) {
    return {
      ok: false,
      output:
        "You have no delivery connector set up. " +
        "Connect Telegram (for phone messages) or Gmail (for email) first — " +
        "use /connect to set one up. At least one is required to use reminders.",
    };
  }

  const { delivery, gmailTo } = resolved;
  const fireAt = new Date(Date.now() + delayMinutes * 60_000);
  const id = insertReminder(userId, message, fireAt, delivery, gmailTo);
  scheduleRow({ id, user_id: userId, message, fire_at: fireAt.toISOString(), delivery, gmail_to: gmailTo, fired: 0 }, delayMinutes * 60_000);

  const timeLabel = fireAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const via = delivery === "gmail" ? `Gmail (${gmailTo})` : "Telegram";

  return {
    ok: true,
    output: `Reminder #${id} set — "${message}" in ${fmtDuration(delayMinutes)} at ${timeLabel} via ${via}.`,
  };
}

export async function listRemindersTool(): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  const rows = getPendingReminders(userId);
  if (rows.length === 0) return { ok: true, output: "No active reminders." };

  const lines = [`Active reminders (${rows.length}):`];
  for (const r of rows) {
    const fireAt = new Date(r.fire_at);
    const remaining = fmtRemaining(fireAt);
    const timeLabel = fireAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const via = r.delivery === "gmail" ? `Gmail (${r.gmail_to})` : "Telegram";
    lines.push(`  #${r.id}  "${r.message}"  —  ${remaining} (${timeLabel})  via ${via}`);
  }

  return { ok: true, output: lines.join("\n") };
}

export async function cancelReminderTool(id: number): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  const row = getReminderById(id, userId);
  if (!row) return { ok: false, output: `No active reminder with ID ${id}.` };

  const handle = _handles.get(id);
  if (handle) { clearTimeout(handle); _handles.delete(id); }

  deleteReminder(id, userId);
  return { ok: true, output: `Reminder #${id} cancelled — "${row.message}".` };
}
