import chalk, { type ChalkInstance } from "chalk";
import keytar from "keytar";
import { ImapFlow } from "imapflow";
import si from "systeminformation";
import { Octokit } from "@octokit/rest";
import db from "../database/db.js";
import { getAllFacts } from "../database/memory.js";
import { getPendingReminders } from "../database/reminders.js";
import type { Session } from "../auth/login.js";

// ── one-time table setup ──────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS briefing_log (
    user_id    INTEGER NOT NULL,
    shown_date TEXT    NOT NULL,
    PRIMARY KEY (user_id, shown_date)
  );
  CREATE TABLE IF NOT EXISTS tg_update_offset (
    user_id INTEGER PRIMARY KEY,
    offset  INTEGER NOT NULL DEFAULT 0
  );
`);

const SERVICE = "jarvis";

// ── briefing gate ─────────────────────────────────────────────────────────────

export function shouldShowBriefing(userId: number): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return !db.prepare(
    "SELECT 1 FROM briefing_log WHERE user_id = ? AND shown_date = ?"
  ).get(userId, today);
}

function markBriefingShown(userId: number): void {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    "INSERT OR IGNORE INTO briefing_log (user_id, shown_date) VALUES (?, ?)"
  ).run(userId, today);
}

// ── panel helpers ─────────────────────────────────────────────────────────────

function W(): number {
  return Math.min((process.stdout.columns || 80) - 2, 100);
}

function headerLine(): void {
  process.stdout.write(chalk.cyan("│") + "\n");
}

function section(title: string): void {
  const line = `── ${title} `;
  const fill = "─".repeat(Math.max(0, W() - 5 - title.length));
  headerLine();
  process.stdout.write(chalk.cyan("│  ") + chalk.dim(line + fill) + "\n");
}

function dataRow(label: string, value: string, valueColor: ChalkInstance = chalk.white): void {
  const pad = 20;
  process.stdout.write(
    chalk.cyan("│") + "  " + chalk.dim(label.padEnd(pad)) + valueColor(value) + "\n"
  );
}

function subRow(text: string): void {
  process.stdout.write(
    chalk.cyan("│") + "      " + chalk.dim("→ ") + chalk.white(
      text.length > W() - 14 ? text.slice(0, W() - 17) + "…" : text
    ) + "\n"
  );
}

// ── data fetchers ─────────────────────────────────────────────────────────────

async function fetchWeather(city: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { headers: { "User-Agent": "curl/7.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      current_condition?: Array<{
        temp_C?: string;
        FeelsLikeC?: string;
        weatherDesc?: Array<{ value?: string }>;
      }>;
    };
    const c = data.current_condition?.[0];
    if (!c) return null;
    const desc = c.weatherDesc?.[0]?.value ?? "";
    return `${c.temp_C ?? "?"}°C  ${desc}  (feels ${c.FeelsLikeC ?? c.temp_C}°C)`;
  } catch {
    return null;
  }
}

async function fetchGmail(userId: number): Promise<{
  unread: number;
  previews: string[];
  connected: boolean;
}> {
  try {
    const stored = await keytar.getPassword(SERVICE, `gmail-${userId}`);
    if (!stored) return { unread: 0, previews: [], connected: false };
    const { email, password } = JSON.parse(stored) as { email: string; password: string };

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    await client.connect();
    try {
      await client.mailboxOpen("INBOX");
      const searchResult = await client.search({ seen: false }, { uid: true });
      const unseenUids = searchResult === false ? [] : searchResult;
      const count = unseenUids.length;
      const previews: string[] = [];

      if (count > 0) {
        const fetchUids = unseenUids.slice(-5).reverse();
        for await (const msg of client.fetch(fetchUids.join(","), { envelope: true }, { uid: true })) {
          const from = msg.envelope?.from?.[0]?.name
            ?? msg.envelope?.from?.[0]?.address
            ?? "Unknown";
          const subj = msg.envelope?.subject ?? "(no subject)";
          previews.push(`${from}: ${subj}`);
        }
      }
      return { unread: count, previews, connected: true };
    } finally {
      await client.logout().catch(() => {});
    }
  } catch {
    return { unread: 0, previews: [], connected: false };
  }
}

async function fetchTelegram(userId: number): Promise<{
  messages: string[];
  connected: boolean;
}> {
  try {
    const stored = await keytar.getPassword(SERVICE, `telegram-${userId}`);
    if (!stored) return { messages: [], connected: false };
    const { token } = JSON.parse(stored) as { token: string; chatId: string };

    const offsetRow = db.prepare(
      "SELECT offset FROM tg_update_offset WHERE user_id = ?"
    ).get(userId) as { offset: number } | undefined;
    const offset = offsetRow?.offset ?? 0;

    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&limit=20&timeout=0`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json() as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        message?: { text?: string; from?: { first_name?: string; last_name?: string } };
      }>;
    };

    if (!data.ok || !data.result?.length) return { messages: [], connected: true };

    const updates = data.result;
    const lastId = updates[updates.length - 1].update_id;
    db.prepare(
      "INSERT OR REPLACE INTO tg_update_offset (user_id, offset) VALUES (?, ?)"
    ).run(userId, lastId + 1);

    const messages: string[] = [];
    for (const u of updates) {
      if (u.message?.text) {
        const fn = u.message.from?.first_name ?? "";
        const ln = u.message.from?.last_name ?? "";
        const name = [fn, ln].filter(Boolean).join(" ") || "User";
        messages.push(`${name}: ${u.message.text}`);
      }
    }
    return { messages, connected: true };
  } catch {
    return { messages: [], connected: false };
  }
}

async function fetchGitHub(userId: number): Promise<{
  prs: number;
  issues: number;
  connected: boolean;
}> {
  try {
    const token = await keytar.getPassword(SERVICE, `github-${userId}`);
    if (!token) return { prs: 0, issues: 0, connected: false };

    const octokit = new Octokit({ auth: token });
    const [prRes, issueRes] = await Promise.allSettled([
      octokit.rest.search.issuesAndPullRequests({ q: "is:pr is:open author:@me", per_page: 1 }),
      octokit.rest.search.issuesAndPullRequests({ q: "is:issue is:open assignee:@me", per_page: 1 }),
    ]);

    return {
      prs: prRes.status === "fulfilled" ? prRes.value.data.total_count : 0,
      issues: issueRes.status === "fulfilled" ? issueRes.value.data.total_count : 0,
      connected: true,
    };
  } catch {
    return { prs: 0, issues: 0, connected: false };
  }
}

async function fetchSystem(): Promise<{
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  disks: { mount: string; free: number; total: number }[];
}> {
  try {
    const [load, mem, fs] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);
    return {
      cpu: Math.round(load.currentLoad),
      ramUsed: mem.active,
      ramTotal: mem.total,
      disks: fs
        .filter((d) => d.size > 500_000_000)
        .slice(0, 4)
        .map((d) => ({ mount: d.mount || d.fs, free: d.available, total: d.size })),
    };
  } catch {
    return { cpu: 0, ramUsed: 0, ramTotal: 0, disks: [] };
  }
}

// ── format helpers ────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${b} B`;
}

function fmtCountdown(fireAt: string): string {
  const diff = new Date(fireAt).getTime() - Date.now();
  if (diff <= 0) return "now";
  const m = Math.round(diff / 60_000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${m % 60}m`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

// ── main export ───────────────────────────────────────────────────────────────

export async function runBriefing(session: Session): Promise<void> {
  const facts = getAllFacts(session.id);
  const factMap = Object.fromEntries(facts.map((f) => [f.key, f.value]));
  const firstName = (factMap.full_name ?? session.username).split(" ")[0];
  const city = factMap.city ?? factMap.location ?? null;

  process.stdout.write(chalk.dim("\n  Preparing your briefing…\n"));

  // Fetch all data sources in parallel
  const [weather, gmail, telegram, github, sys] = await Promise.all([
    city ? fetchWeather(city) : Promise.resolve<string | null>(null),
    fetchGmail(session.id),
    fetchTelegram(session.id),
    fetchGitHub(session.id),
    fetchSystem(),
  ]);

  const reminders = getPendingReminders(session.id).slice(0, 5);

  // ── render panel ───────────────────────────────────────────────────────────
  const w = W();
  const greet = `${greeting()}, ${firstName.toUpperCase()}`;
  const tag = ` ◈ ${greet} `;
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  process.stdout.write("\n");
  process.stdout.write(chalk.cyan(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(
    chalk.cyan("│") + "  " +
    chalk.bold.white(dateLabel) +
    chalk.dim("  ·  ") + chalk.white(timeLabel) +
    (weather && city ? chalk.dim("  ·  ") + chalk.yellow(weather) + chalk.dim(`  (${city})`) : "") +
    "\n"
  );

  // ── COMMUNICATIONS ─────────────────────────────────────────────────────────
  section("COMMUNICATIONS");

  // Gmail
  if (!gmail.connected) {
    dataRow("Email", "Not connected", chalk.dim);
  } else if (gmail.unread === 0) {
    dataRow("Email", "Inbox clear — no unread messages", chalk.green);
  } else {
    dataRow("Email", `${gmail.unread} unread message${gmail.unread > 1 ? "s" : ""}`, chalk.yellow);
    for (const p of gmail.previews) subRow(p);
  }

  // Telegram
  if (!telegram.connected) {
    dataRow("Telegram", "Not connected", chalk.dim);
  } else if (telegram.messages.length === 0) {
    dataRow("Telegram", "No new messages", chalk.dim);
  } else {
    dataRow("Telegram", `${telegram.messages.length} new message${telegram.messages.length > 1 ? "s" : ""}`, chalk.yellow);
    for (const m of telegram.messages.slice(0, 5)) subRow(m);
  }

  // ── GITHUB ─────────────────────────────────────────────────────────────────
  if (github.connected) {
    section("GITHUB");
    const prColor = github.prs > 0 ? chalk.yellow : chalk.green;
    const issColor = github.issues > 5 ? chalk.red : github.issues > 0 ? chalk.yellow : chalk.green;
    dataRow("Open PRs", github.prs > 0 ? `${github.prs} waiting for your review` : "None open", prColor);
    dataRow("Assigned issues", github.issues > 0 ? `${github.issues} open` : "None assigned", issColor);
  }

  // ── REMINDERS ──────────────────────────────────────────────────────────────
  if (reminders.length > 0) {
    section("REMINDERS");
    for (const r of reminders) {
      dataRow("⏰", `${r.message}  —  ${fmtCountdown(r.fire_at)}  via ${r.delivery}`, chalk.yellow);
    }
  }

  // ── SYSTEM STATUS ──────────────────────────────────────────────────────────
  section("SYSTEM STATUS");

  const cpuColor = sys.cpu > 85 ? chalk.red : sys.cpu > 60 ? chalk.yellow : chalk.green;
  dataRow("CPU", `${sys.cpu}%`, cpuColor);

  if (sys.ramTotal > 0) {
    const ramPct = Math.round((sys.ramUsed / sys.ramTotal) * 100);
    const ramColor = ramPct > 90 ? chalk.red : ramPct > 70 ? chalk.yellow : chalk.green;
    dataRow("RAM", `${fmtBytes(sys.ramUsed)} / ${fmtBytes(sys.ramTotal)}  (${ramPct}% used)`, ramColor);
  }

  for (const d of sys.disks) {
    const usedPct = d.total > 0 ? Math.round((1 - d.free / d.total) * 100) : 0;
    const freeColor = usedPct > 90 ? chalk.red : usedPct > 75 ? chalk.yellow : chalk.green;
    dataRow(`Disk ${d.mount}`, `${fmtBytes(d.free)} free  (${usedPct}% used)`, freeColor);
  }

  // ── LAST SESSION ───────────────────────────────────────────────────────────
  const project = factMap.current_project ?? null;
  const workingOn = factMap.working_on ?? factMap.last_topic ?? null;
  if (project || workingOn) {
    section("LAST SESSION");
    if (project) dataRow("Project", project);
    if (workingOn) dataRow("Working on", workingOn);
  }

  headerLine();
  process.stdout.write(chalk.cyan(`╰${"─".repeat(w - 1)}`) + "\n\n");

  markBriefingShown(session.id);
}
