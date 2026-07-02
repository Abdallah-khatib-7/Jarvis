import keytar from "keytar";
import inquirer from "inquirer";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { stopThinking } from "../ui/thinking.js";
import { getActiveUserId } from "../tools/memoryTools.js";
import type { ToolResult } from "../tools/fileTools.js";

// ── session-only cache (for users who choose not to persist) ──────────────────

const SERVICE = "jarvis";
const keytarAcct = (userId: number) => `telegram-${userId}`;

let _sessionToken: string | null = null;
let _sessionChatId: string | null = null;

// ── telegram HTTP helper ──────────────────────────────────────────────────────

type TgResponse = { ok: boolean; description?: string; result?: unknown };

async function tgPost(token: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TgResponse;
  if (!data.ok) throw new Error(`Telegram: ${data.description ?? "unknown error"}`);
  return data.result;
}

async function validateToken(token: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = (await res.json()) as TgResponse & { result?: { username?: string } };
  if (!data.ok) throw new Error(`Invalid token — ${data.description ?? "Telegram rejected it"}`);
  return data.result?.username ?? "your bot";
}

// ── terminal panel helpers ────────────────────────────────────────────────────

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function panelLine(label: string, value: string): void {
  process.stdout.write(chalk.cyan("│") + "  " + chalk.dim(label) + " " + chalk.white(value) + "\n");
}

function setupPanel(): void {
  const w = termWidth();
  const tag = " ◈ CONNECT TELEGRAM ";
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));
  process.stdout.write("\n");
  process.stdout.write(chalk.cyan(`╭─${tag}${fill}`) + "\n");
  panelLine("Step 1:", "Paste your bot token below (from @BotFather)");
  panelLine("Step 2:", "Get your chat ID from @userinfobot → send it /start → copy the Id: number");
  process.stdout.write(chalk.cyan(`╰${"─".repeat(w - 1)}`) + "\n\n");
}

// ── credential setup ──────────────────────────────────────────────────────────

async function runSetup(userId: number): Promise<{ token: string; chatId: string }> {
  setupPanel();

  const { token } = await inquirer.prompt<{ token: string }>([
    { type: "password", name: "token", message: "Bot token:", mask: "*" },
  ]);
  const trimmedToken = token.trim();
  if (!trimmedToken) throw new Error("No token provided.");

  process.stdout.write(chalk.dim("\n  Validating token…\n"));
  const botName = await validateToken(trimmedToken);
  process.stdout.write(chalk.green(`  ✓ Connected to @${botName}\n\n`));

  const { chatId } = await inquirer.prompt<{ chatId: string }>([
    {
      type: "input",
      name: "chatId",
      message: "Your Telegram chat ID (get it from @userinfobot):",
      validate: (v: string) => /^-?\d+$/.test(v.trim()) || "Must be a number — open @userinfobot and send /start",
    },
  ]);
  const trimmedId = chatId.trim();

  const { remember } = await inquirer.prompt<{ remember: boolean }>([
    {
      type: "confirm",
      name: "remember",
      message: "Remember this for future sessions?",
      default: true,
    },
  ]);

  if (remember) {
    await keytar.setPassword(SERVICE, keytarAcct(userId), JSON.stringify({ token: trimmedToken, chatId: trimmedId }));
    process.stdout.write(chalk.green("\n  ✓ Saved to OS credential store.\n\n"));
  } else {
    process.stdout.write(chalk.dim("\n  Kept for this session only.\n\n"));
  }

  return { token: trimmedToken, chatId: trimmedId };
}

async function getCredentials(): Promise<{ token: string; chatId: string }> {
  if (_sessionToken && _sessionChatId) {
    return { token: _sessionToken, chatId: _sessionChatId };
  }

  const userId = getActiveUserId();
  if (userId === null) throw new Error("No active user session.");

  const stored = await keytar.getPassword(SERVICE, keytarAcct(userId));
  if (stored) {
    const creds = JSON.parse(stored) as { token: string; chatId: string };
    _sessionToken = creds.token;
    _sessionChatId = creds.chatId;
    return creds;
  }

  stopThinking();
  const creds = await runSetup(userId);
  _sessionToken = creds.token;
  _sessionChatId = creds.chatId;
  return creds;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ── tools ─────────────────────────────────────────────────────────────────────

export async function telegramConnectTool(): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  // Already connected this session — don't re-prompt
  if (_sessionToken && _sessionChatId) {
    return { ok: true, output: "Telegram is already connected and ready to use." };
  }

  // Credentials saved in OS store — load without re-prompting
  const stored = await keytar.getPassword(SERVICE, keytarAcct(userId));
  if (stored) {
    const creds = JSON.parse(stored) as { token: string; chatId: string };
    _sessionToken = creds.token;
    _sessionChatId = creds.chatId;
    return { ok: true, output: "Telegram already connected and ready to use." };
  }

  // Nothing stored — run full setup
  stopThinking();
  try {
    const creds = await runSetup(userId);
    _sessionToken = creds.token;
    _sessionChatId = creds.chatId;
    return { ok: true, output: "Telegram connected successfully. Ready to send messages." };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function telegramSendTool(message: string): Promise<ToolResult> {
  try {
    const { token, chatId } = await getCredentials();
    await tgPost(token, "sendMessage", { chat_id: chatId, text: message, parse_mode: "HTML" });
    return { ok: true, output: "Message sent to your Telegram." };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function telegramSendFileTool(path: string, caption?: string): Promise<ToolResult> {
  try {
    const { token, chatId } = await getCredentials();

    const fileBuffer = await readFile(path);
    const fileName = basename(path);

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", new Blob([fileBuffer]), fileName);
    if (caption) form.append("caption", caption);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as TgResponse;
    if (!data.ok) throw new Error(`Telegram: ${data.description ?? "upload failed"}`);

    return { ok: true, output: `File "${fileName}" sent to your Telegram.` };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function telegramDisconnectTool(): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  _sessionToken = null;
  _sessionChatId = null;

  const had = await keytar.getPassword(SERVICE, keytarAcct(userId));
  if (had) await keytar.deletePassword(SERVICE, keytarAcct(userId));

  return {
    ok: true,
    output: had
      ? "Telegram disconnected and credentials removed. Use telegram_connect to set it up again."
      : "Session credentials cleared. No persistent token was stored.",
  };
}
