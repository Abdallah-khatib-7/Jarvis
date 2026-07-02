import chalk from "chalk";
import type { ToolResult } from "./fileTools.js";

// ── types ─────────────────────────────────────────────────────────────────────

interface Reminder {
  id: number;
  message: string;
  fireAt: Date;
  handle: ReturnType<typeof setTimeout>;
}

// ── state ─────────────────────────────────────────────────────────────────────

let _nextId = 1;
const _active = new Map<number, Reminder>();

// ── alert UI ──────────────────────────────────────────────────────────────────

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

async function fireReminder(r: Reminder): Promise<void> {
  _active.delete(r.id);

  const w = termWidth();
  const tag = " ⏰ REMINDER ";
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));

  process.stdout.write("\x07\n"); // terminal bell + newline
  process.stdout.write(chalk.yellow(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(chalk.yellow("│") + "  " + chalk.bold.white(r.message) + "\n");
  process.stdout.write(chalk.yellow(`╰${"─".repeat(w - 1)}`) + "\n\n");

  // Best-effort Telegram send (not imported at module level to avoid circular dep)
  try {
    const { telegramSendTool } = await import("../connectors/telegram.js");
    await telegramSendTool(`⏰ Reminder: ${r.message}`);
  } catch {
    // Telegram not connected — terminal alert is enough
  }
}

// ── tools ─────────────────────────────────────────────────────────────────────

export async function setReminderTool(
  message: string,
  delayMinutes: number
): Promise<ToolResult> {
  if (!Number.isFinite(delayMinutes) || delayMinutes < 1 || delayMinutes > 1440) {
    return { ok: false, output: "Delay must be between 1 minute and 24 hours (1440 min)." };
  }

  const id = _nextId++;
  const fireAt = new Date(Date.now() + delayMinutes * 60_000);

  const handle = setTimeout(() => {
    fireReminder({ id, message, fireAt, handle }).catch(() => {});
  }, delayMinutes * 60_000);

  // Don't let the timer keep the process alive if the user exits
  if (typeof handle === "object" && handle !== null && "unref" in handle) {
    (handle as { unref(): void }).unref();
  }

  _active.set(id, { id, message, fireAt, handle });

  const timeLabel = fireAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const durationLabel =
    delayMinutes < 60
      ? `${delayMinutes} minute${delayMinutes === 1 ? "" : "s"}`
      : delayMinutes % 60 === 0
      ? `${delayMinutes / 60} hour${delayMinutes / 60 === 1 ? "" : "s"}`
      : `${Math.floor(delayMinutes / 60)}h ${delayMinutes % 60}m`;

  return {
    ok: true,
    output: `Reminder #${id} set — "${message}" in ${durationLabel} at ${timeLabel}.`,
  };
}

export async function listRemindersTool(): Promise<ToolResult> {
  if (_active.size === 0) {
    return { ok: true, output: "No active reminders." };
  }

  const lines = [`Active reminders (${_active.size}):`];
  for (const r of [..._active.values()].sort((a, b) => +a.fireAt - +b.fireAt)) {
    const msLeft = r.fireAt.getTime() - Date.now();
    const minsLeft = Math.max(0, Math.round(msLeft / 60_000));
    const timeLabel = r.fireAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const remaining =
      minsLeft === 0
        ? "< 1 min"
        : minsLeft < 60
        ? `${minsLeft} min`
        : `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`;
    lines.push(`  #${r.id}  "${r.message}"  —  ${remaining} (${timeLabel})`);
  }

  return { ok: true, output: lines.join("\n") };
}

export async function cancelReminderTool(id: number): Promise<ToolResult> {
  const r = _active.get(id);
  if (!r) {
    return { ok: false, output: `No active reminder with ID ${id}.` };
  }
  clearTimeout(r.handle);
  _active.delete(id);
  return { ok: true, output: `Reminder #${id} cancelled — "${r.message}".` };
}

export function getActiveReminders(): Map<number, Reminder> {
  return _active;
}
