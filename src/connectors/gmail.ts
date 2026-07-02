import keytar from "keytar";
import inquirer from "inquirer";
import chalk, { type ChalkInstance } from "chalk";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { stopThinking } from "../ui/thinking.js";
import { getActiveUserId } from "../tools/memoryTools.js";
import type { ToolResult } from "../tools/fileTools.js";

// ── credential store ──────────────────────────────────────────────────────────

const SERVICE = "jarvis";
const keytarAcct = (userId: number) => `gmail-${userId}`;

let _sessionEmail: string | null = null;
let _sessionPassword: string | null = null;

// ── imap helper ───────────────────────────────────────────────────────────────

async function withImap<T>(
  email: string,
  password: string,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

// ── panel helpers ─────────────────────────────────────────────────────────────

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function hline(w = termWidth()): string {
  return "─".repeat(Math.max(0, w));
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function panelOpen(icon: string, label: string, subtitle: string, color: ChalkInstance): void {
  const w = termWidth();
  const tag = ` ${icon} ${label} `;
  const fill = hline(Math.max(0, w - 2 - stripAnsi(tag).length));
  process.stdout.write("\n");
  process.stdout.write(color(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(color("│") + "  " + chalk.bold.white(subtitle) + "\n");
}

function panelLine(text: string, color: ChalkInstance): void {
  process.stdout.write(color("│") + "  " + chalk.white(text) + "\n");
}

function panelClose(color: ChalkInstance): void {
  process.stdout.write(color(`╰${hline(termWidth() - 1)}`) + "\n\n");
}

// ── date formatter ────────────────────────────────────────────────────────────

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString();
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("AUTHENTICATIONFAILED") || err.message.includes("Invalid credentials"))
      return "Gmail authentication failed. Check your email and App Password.";
    return err.message;
  }
  return String(err);
}

// ── setup ─────────────────────────────────────────────────────────────────────

async function runSetup(userId: number): Promise<{ email: string; password: string }> {
  const w = termWidth();
  const tag = " ◈ CONNECT GMAIL ";
  const fill = hline(Math.max(0, w - 2 - tag.length));
  process.stdout.write("\n");
  process.stdout.write(chalk.red(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(chalk.red("│") + "  " + chalk.white("You need a Gmail App Password (not your regular password).") + "\n");
  process.stdout.write(chalk.red("│") + "  " + chalk.dim("myaccount.google.com → Security → App Passwords → Create") + "\n");
  process.stdout.write(chalk.red(`╰${hline(w - 1)}`) + "\n\n");

  const { email } = await inquirer.prompt<{ email: string }>([
    { type: "input", name: "email", message: "Your Gmail address:" },
  ]);

  const { password } = await inquirer.prompt<{ password: string }>([
    { type: "password", name: "password", message: "App Password (16 chars, no spaces):", mask: "*" },
  ]);

  const trimEmail = email.trim();
  const trimPass = password.replace(/\s/g, "");

  if (!trimEmail || !trimPass) throw new Error("Email and App Password are both required.");

  process.stdout.write(chalk.dim("\n  Verifying credentials…\n"));
  await withImap(trimEmail, trimPass, async () => {});
  process.stdout.write(chalk.green("  ✓ Connected to Gmail.\n\n"));

  const { remember } = await inquirer.prompt<{ remember: boolean }>([
    { type: "confirm", name: "remember", message: "Remember this for future sessions?", default: true },
  ]);

  if (remember) {
    await keytar.setPassword(SERVICE, keytarAcct(userId), JSON.stringify({ email: trimEmail, password: trimPass }));
    process.stdout.write(chalk.green("  ✓ Saved to OS credential store.\n\n"));
  } else {
    process.stdout.write(chalk.dim("  Kept for this session only.\n\n"));
  }

  return { email: trimEmail, password: trimPass };
}

async function getCredentials(): Promise<{ email: string; password: string }> {
  if (_sessionEmail && _sessionPassword) {
    return { email: _sessionEmail, password: _sessionPassword };
  }

  const userId = getActiveUserId();
  if (userId === null) throw new Error("No active user session.");

  const stored = await keytar.getPassword(SERVICE, keytarAcct(userId));
  if (stored) {
    const creds = JSON.parse(stored) as { email: string; password: string };
    _sessionEmail = creds.email;
    _sessionPassword = creds.password;
    return creds;
  }

  stopThinking();
  const creds = await runSetup(userId);
  _sessionEmail = creds.email;
  _sessionPassword = creds.password;
  return creds;
}

// ── tools ─────────────────────────────────────────────────────────────────────

export async function gmailConnectTool(): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  stopThinking();
  _sessionEmail = null;
  _sessionPassword = null;

  try {
    const creds = await runSetup(userId);
    _sessionEmail = creds.email;
    _sessionPassword = creds.password;
    return { ok: true, output: "Gmail connected successfully." };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function gmailSendTool(to: string, subject: string, body: string): Promise<ToolResult> {
  try {
    const { email, password } = await getCredentials();

    stopThinking();
    const color = chalk.red;
    panelOpen("◈", "SEND EMAIL", `To: ${to}`, color);
    panelLine(`From:    ${email}`, color);
    panelLine(`Subject: ${subject}`, color);
    panelLine("", color);

    const maxW = termWidth() - 6;
    for (const rawLine of body.split("\n")) {
      if (!rawLine.trim()) { panelLine("", color); continue; }
      let current = "";
      for (const word of rawLine.split(" ")) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxW && current) { panelLine(current, color); current = word; }
        else { current = next; }
      }
      if (current) panelLine(current, color);
    }

    panelClose(color);

    const { go } = await inquirer.prompt<{ go: boolean }>([
      { type: "confirm", name: "go", message: "Send this email?", default: false },
    ]);

    if (!go) return { ok: false, output: "Email cancelled." };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: password },
    });

    await transporter.sendMail({ from: email, to, subject, text: body });
    console.log(chalk.red(`\n  ✓ Email sent to ${to}\n`));
    return { ok: true, output: `Email sent to ${to} · subject: "${subject}"` };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function gmailInboxTool(limit = 15): Promise<ToolResult> {
  try {
    const { email, password } = await getCredentials();

    return await withImap(email, password, async (client) => {
      const mailbox = await client.mailboxOpen("INBOX");
      const total = mailbox.exists;

      if (total === 0) return { ok: true, output: "Your inbox is empty." };

      const start = Math.max(1, total - limit + 1);
      const lines = [`Inbox — last ${Math.min(limit, total)} of ${total} messages:`];
      const msgs: Array<{ uid: number; from: string; subject: string; date: string; unread: boolean }> = [];

      for await (const msg of client.fetch(`${start}:${total}`, {
        envelope: true,
        flags: true,
        uid: true,
      })) {
        if (!msg.envelope || !msg.flags) continue;
        const sender = msg.envelope.from?.[0];
        const from = sender?.name || sender?.address || "Unknown";
        msgs.push({
          uid: msg.uid,
          from,
          subject: msg.envelope.subject ?? "(no subject)",
          date: fmtDate(msg.envelope.date),
          unread: !msg.flags.has("\\Seen"),
        });
      }

      for (const m of msgs.reverse()) {
        const mark = m.unread ? chalk.white(" ●") : chalk.dim(" ○");
        lines.push(`  UID ${m.uid}${mark} · ${m.from} · ${m.subject} · ${m.date}`);
      }

      return { ok: true, output: lines.join("\n") };
    });
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function gmailSearchTool(
  from?: string,
  subject?: string,
  text?: string,
  unread?: boolean
): Promise<ToolResult> {
  try {
    const { email, password } = await getCredentials();

    return await withImap(email, password, async (client) => {
      await client.mailboxOpen("INBOX");

      const query: Record<string, unknown> = {};
      if (from) query["from"] = from;
      if (subject) query["subject"] = subject;
      if (text) query["body"] = text;
      if (unread) query["seen"] = false;

      if (Object.keys(query).length === 0) {
        return { ok: false, output: "Provide at least one search filter: from, subject, text, or unread." };
      }

      const rawUids = await client.search(query, { uid: true });
      const uids = Array.isArray(rawUids) ? rawUids : [];
      if (uids.length === 0) return { ok: true, output: "No matching emails found." };

      const limited = uids.slice(-15);
      const lines = [`Found ${uids.length} match(es) — showing ${limited.length}:`];

      for await (const msg of client.fetch(limited, { envelope: true, flags: true, uid: true }, { uid: true })) {
        if (!msg.envelope || !msg.flags) continue;
        const sender = msg.envelope.from?.[0];
        const fromStr = sender?.name || sender?.address || "Unknown";
        const mark = !msg.flags.has("\\Seen") ? " ●" : " ○";
        lines.push(
          `  UID ${msg.uid}${mark} · ${fromStr} · ${msg.envelope.subject ?? "(no subject)"} · ${fmtDate(msg.envelope.date)}`
        );
      }

      return { ok: true, output: lines.join("\n") };
    });
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function gmailReadTool(uid: number): Promise<ToolResult> {
  try {
    const { email, password } = await getCredentials();

    return await withImap(email, password, async (client) => {
      await client.mailboxOpen("INBOX");

      const rawMsg = await client.fetchOne(
        String(uid),
        { source: true, envelope: true, flags: true },
        { uid: true }
      );

      if (!rawMsg || typeof rawMsg === "boolean" || !rawMsg.source) {
        return { ok: false, output: `Message UID ${uid} not found in inbox.` };
      }

      const parsed = await simpleParser(rawMsg.source as Buffer);

      const sender = parsed.from?.value?.[0];
      const fromStr = sender?.name ? `${sender.name} <${sender.address}>` : (sender?.address ?? "Unknown");

      const toStr = Array.isArray(parsed.to)
        ? parsed.to.map((a) => a.text).join(", ")
        : (parsed.to?.text ?? "—");

      const htmlText = typeof parsed.html === "string"
        ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : "";

      const body = parsed.text?.trim() || htmlText || "(no readable content)";

      const MAX = 4000;
      const lines = [
        `From:    ${fromStr}`,
        `To:      ${toStr}`,
        `Subject: ${parsed.subject ?? "(no subject)"}`,
        `Date:    ${parsed.date?.toLocaleString() ?? "—"}`,
        ``,
        body.slice(0, MAX) + (body.length > MAX ? "\n\n... (truncated)" : ""),
      ];

      return { ok: true, output: lines.join("\n") };
    });
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function sendEmailDirect(
  fromEmail: string,
  password: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: fromEmail, pass: password },
  });
  await transporter.sendMail({ from: fromEmail, to, subject, text: body });
}

export async function gmailDisconnectTool(): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  _sessionEmail = null;
  _sessionPassword = null;

  const had = await keytar.getPassword(SERVICE, keytarAcct(userId));
  if (had) await keytar.deletePassword(SERVICE, keytarAcct(userId));

  return {
    ok: true,
    output: had
      ? "Gmail disconnected and credentials removed. Use gmail_connect to reconnect."
      : "Session credentials cleared.",
  };
}
