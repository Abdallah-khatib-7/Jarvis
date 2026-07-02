import inquirer from "inquirer";
import chalk from "chalk";
import keytar from "keytar";
import { setFact, getAllFacts } from "../database/memory.js";
import { getActiveUserId } from "../tools/memoryTools.js";
import { PERSONALITIES } from "../ai/personality.js";
import { runTour } from "./tour.js";
import type { Session } from "../auth/login.js";

// ── return type ───────────────────────────────────────────────────────────────

export type SlashResult =
  | { kind: "message"; text: string }
  | { kind: "handled" }
  | { kind: "clear" }
  | { kind: "exit" };

// ── helpers ───────────────────────────────────────────────────────────────────

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function hline(n: number): string {
  return "─".repeat(Math.max(0, n));
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function panelOpen(tag: string, color: (s: string) => string): void {
  const w = termWidth();
  const fill = hline(Math.max(0, w - 2 - stripAnsi(tag).length));
  process.stdout.write("\n");
  process.stdout.write(color(`╭─${tag}${fill}`) + "\n");
}

function panelLine(content: string, color: (s: string) => string): void {
  process.stdout.write(color("│") + content + "\n");
}

function panelClose(color: (s: string) => string): void {
  process.stdout.write(color(`╰${hline(termWidth() - 1)}`) + "\n\n");
}

// ── /help ─────────────────────────────────────────────────────────────────────

function row(cmd: string, desc: string): string {
  return "  " + chalk.bold.yellow(cmd.padEnd(18)) + chalk.dim(desc);
}

function ex(phrase: string, result: string): string {
  const p = phrase.padEnd(42);
  return "  " + chalk.dim(p) + chalk.dim("→  ") + chalk.white(result);
}

function showHelp(): void {
  const c = chalk.yellow;
  panelOpen(" ◈ JARVIS COMMAND REFERENCE ", c);

  const lines: string[] = [
    "",
    "  " + chalk.dim("Type  ") + chalk.bold.yellow("/") + chalk.dim("  to open the interactive menu, or type a command directly."),
    "",
    "  " + chalk.white("── AI & MEMORY ─────────────────────────────────────────────────────"),
    row("/help", "This reference"),
    row("/memory", "View all your stored facts"),
    row("/clear", "Start a fresh conversation (history wiped)"),
    row("/provider", "Switch AI: Claude ↔ OpenAI (takes effect next message)"),
    row("/personality", "Change JARVIS voice and tone"),
    "",
    "  " + chalk.white("── CONNECTIONS ─────────────────────────────────────────────────────"),
    row("/connect", "Set up GitHub, Telegram, or Gmail"),
    row("/disconnect", "Remove a stored connection"),
    row("/status", "What's currently connected and which AI is active"),
    "",
    "  " + chalk.white("── QUICK ACTIONS ───────────────────────────────────────────────────"),
    row("/search", "Search the web (prompts for query)"),
    row("/news", "Search latest news (prompts for query)"),
    row("/inbox", "Open Gmail inbox (last 15 emails)"),
    row("/repos", "List your GitHub repositories"),
    row("/prs", "Your open pull requests"),
    row("/issues", "Issues assigned to you on GitHub"),
    "",
    "  " + chalk.white("── SYSTEM ──────────────────────────────────────────────────────────"),
    row("/tour", "Replay the first-run welcome tour"),
    row("/exit", "Power down JARVIS"),
    "",
    "  " + chalk.white("── NATURAL LANGUAGE EXAMPLES ───────────────────────────────────────"),
    ex(`"fix the bug in src/api.ts"`, "edits the file directly"),
    ex(`"email Ahmed about the deadline"`, "Gmail compose + confirm"),
    ex(`"any unread emails from the team?"`, "Gmail search"),
    ex(`"create an issue: add dark mode"`, "GitHub issue + confirm"),
    ex(`"run npm test and tell me results"`, "executes + summarizes"),
    ex(`"remember I prefer Python"`, "stored to long-term memory"),
    ex(`"send me a Telegram when the build is done"`, "sends to your phone"),
    ex(`"read src/app.ts and explain line 42"`, "reads file + explains"),
    "",
  ];

  for (const line of lines) panelLine(line, c);
  panelClose(c);
}

// ── /memory ───────────────────────────────────────────────────────────────────

function showMemory(session: Session): void {
  const facts = getAllFacts(session.id);
  const c = chalk.magenta;
  panelOpen(" ◈ YOUR MEMORY ", c);

  if (facts.length === 0) {
    panelLine(
      "  " + chalk.dim("Nothing stored yet. I'll remember things as we talk."),
      c
    );
  } else {
    for (const f of facts) {
      panelLine(
        "  " +
          chalk.magenta(f.key.padEnd(22)) +
          chalk.dim("→  ") +
          chalk.white(f.value),
        c
      );
    }
  }

  panelClose(c);
}

// ── /status ───────────────────────────────────────────────────────────────────

async function showStatus(session: Session): Promise<void> {
  const userId = getActiveUserId();
  if (!userId) return;

  const [github, telegram, gmailRaw] = await Promise.all([
    keytar.getPassword("jarvis", `github-${userId}`),
    keytar.getPassword("jarvis", `telegram-${userId}`),
    keytar.getPassword("jarvis", `gmail-${userId}`),
  ]);

  const aiPref = getAllFacts(session.id).find((f) => f.key === "ai_provider")
    ?.value;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  let aiLabel: string;
  if ((aiPref === "claude" || (!aiPref && hasAnthropic)) && hasAnthropic) {
    aiLabel = chalk.green("✓ Claude (sonnet-4-6)");
    if (!aiPref) aiLabel += chalk.dim("  [auto-selected]");
  } else if ((aiPref === "openai" || (!aiPref && !hasAnthropic)) && hasOpenAI) {
    aiLabel = chalk.green("✓ OpenAI (gpt-4o-mini)");
    if (!aiPref) aiLabel += chalk.dim("  [auto-selected]");
  } else {
    aiLabel = chalk.red("✗ No key configured");
  }

  let gmailLabel: string;
  if (gmailRaw) {
    try {
      const { email } = JSON.parse(gmailRaw) as { email: string };
      gmailLabel = chalk.green(`✓ Connected  (${email})`);
    } catch {
      gmailLabel = chalk.green("✓ Connected");
    }
  } else {
    gmailLabel = chalk.dim("✗ Not connected");
  }

  const c = chalk.cyan;
  panelOpen(" ◈ JARVIS STATUS ", c);
  panelLine("  " + chalk.dim("AI Provider  ") + aiLabel, c);
  panelLine(c("│"), c);
  panelLine(
    "  " +
      chalk.dim("GitHub       ") +
      (github ? chalk.green("✓ Connected") : chalk.dim("✗ Not connected")),
    c
  );
  panelLine(
    "  " +
      chalk.dim("Telegram     ") +
      (telegram ? chalk.green("✓ Connected") : chalk.dim("✗ Not connected")),
    c
  );
  panelLine("  " + chalk.dim("Gmail        ") + gmailLabel, c);
  panelClose(c);
}

// ── /provider ─────────────────────────────────────────────────────────────────

async function switchProvider(session: Session): Promise<void> {
  const { choice } = await inquirer.prompt<{ choice: string }>([
    {
      type: "select",
      name: "choice",
      message: "Switch AI provider:",
      choices: [
        {
          name: "Claude (sonnet-4-6)    — more capable, better reasoning",
          value: "claude",
        },
        {
          name: "OpenAI (gpt-4o-mini)   — faster, lighter",
          value: "openai",
        },
      ],
    },
  ]);
  setFact(session.id, "ai_provider", choice);
  console.log(
    chalk.green(
      `\n  ✓ Switched to ${choice}. Takes effect on your next message.\n`
    )
  );
}

// ── /personality ──────────────────────────────────────────────────────────────

async function switchPersonality(session: Session): Promise<void> {
  const { choice } = await inquirer.prompt<{ choice: string }>([
    {
      type: "select",
      name: "choice",
      message: "Choose JARVIS personality:",
      choices: PERSONALITIES.map((p) => ({ name: p.label, value: p.key })),
    },
  ]);
  setFact(session.id, "personality", choice);
  const p = PERSONALITIES.find((x) => x.key === choice)!;
  console.log(
    chalk.green(
      `\n  ✓ Personality set to "${p.label.split("—")[0].trim()}".\n`
    )
  );
}

// ── /connect ──────────────────────────────────────────────────────────────────

async function connectService(): Promise<SlashResult> {
  const { service } = await inquirer.prompt<{ service: string }>([
    {
      type: "select",
      name: "service",
      message: "Connect which service?",
      choices: [
        { name: "GitHub    — repos, issues, PRs, CI runs", value: "github" },
        { name: "Gmail     — read and send emails", value: "gmail" },
        { name: "Telegram  — messages to your phone", value: "telegram" },
      ],
    },
  ]);
  const msgs: Record<string, string> = {
    github: "connect github and prompt me for my personal access token",
    gmail: "connect gmail",
    telegram: "connect telegram",
  };
  return { kind: "message", text: msgs[service] };
}

// ── /disconnect ───────────────────────────────────────────────────────────────

async function disconnectService(): Promise<SlashResult> {
  const { service } = await inquirer.prompt<{ service: string }>([
    {
      type: "select",
      name: "service",
      message: "Disconnect which service?",
      choices: [
        { name: "GitHub", value: "github" },
        { name: "Gmail", value: "gmail" },
        { name: "Telegram", value: "telegram" },
      ],
    },
  ]);
  return { kind: "message", text: `disconnect ${service}` };
}

// ── menu ──────────────────────────────────────────────────────────────────────

async function showMenu(): Promise<string> {
  const S = inquirer.Separator;

  const { cmd } = await inquirer.prompt<{ cmd: string }>([
    {
      type: "select",
      name: "cmd",
      message: "Choose a command",
      pageSize: 22,
      choices: [
        new S(chalk.dim(" ─── AI & MEMORY ─────────────────────────────────────── ")),
        {
          name: chalk.yellow("/help") + chalk.dim("           Browse all JARVIS commands"),
          value: "/help",
        },
        {
          name: chalk.yellow("/memory") + chalk.dim("         View your stored facts"),
          value: "/memory",
        },
        {
          name: chalk.yellow("/clear") + chalk.dim("          Start a fresh conversation"),
          value: "/clear",
        },
        {
          name: chalk.yellow("/provider") + chalk.dim("       Switch AI: Claude ↔ OpenAI"),
          value: "/provider",
        },
        {
          name: chalk.yellow("/personality") + chalk.dim("    Change JARVIS voice & tone"),
          value: "/personality",
        },

        new S(chalk.dim(" ─── CONNECTIONS ─────────────────────────────────────── ")),
        {
          name: chalk.yellow("/connect") + chalk.dim("        Set up GitHub, Telegram, or Gmail"),
          value: "/connect",
        },
        {
          name: chalk.yellow("/disconnect") + chalk.dim("     Remove a saved connection"),
          value: "/disconnect",
        },
        {
          name: chalk.yellow("/status") + chalk.dim("         What's currently connected"),
          value: "/status",
        },

        new S(chalk.dim(" ─── QUICK ACTIONS ───────────────────────────────────── ")),
        {
          name: chalk.yellow("/search") + chalk.dim("         Search the web"),
          value: "/search",
        },
        {
          name: chalk.yellow("/news") + chalk.dim("           Search latest news"),
          value: "/news",
        },
        {
          name: chalk.yellow("/inbox") + chalk.dim("          Open Gmail inbox"),
          value: "/inbox",
        },
        {
          name: chalk.yellow("/repos") + chalk.dim("          List GitHub repositories"),
          value: "/repos",
        },
        {
          name: chalk.yellow("/prs") + chalk.dim("            Your open pull requests"),
          value: "/prs",
        },
        {
          name: chalk.yellow("/issues") + chalk.dim("         Issues assigned to you"),
          value: "/issues",
        },

        new S(chalk.dim(" ─── SYSTEM ──────────────────────────────────────────── ")),
        {
          name: chalk.yellow("/tour") + chalk.dim("           Replay the welcome tour"),
          value: "/tour",
        },
        {
          name: chalk.yellow("/exit") + chalk.dim("           Power down JARVIS"),
          value: "/exit",
        },
      ],
    },
  ]);

  return cmd;
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function handleSlash(
  input: string,
  session: Session
): Promise<SlashResult> {
  const cmd = input.trim() === "/" ? await showMenu() : input.trim().toLowerCase();

  switch (cmd) {
    case "/help":
      showHelp();
      return { kind: "handled" };

    case "/memory":
      showMemory(session);
      return { kind: "handled" };

    case "/clear":
      console.log(chalk.dim("\n  Conversation cleared.\n"));
      return { kind: "clear" };

    case "/exit":
      return { kind: "exit" };

    case "/status":
      await showStatus(session);
      return { kind: "handled" };

    case "/tour":
      await runTour(session);
      return { kind: "handled" };

    case "/provider":
      await switchProvider(session);
      return { kind: "handled" };

    case "/personality":
      await switchPersonality(session);
      return { kind: "handled" };

    case "/connect":
      return connectService();

    case "/disconnect":
      return disconnectService();

    case "/search": {
      const { q } = await inquirer.prompt<{ q: string }>([
        { type: "input", name: "q", message: "Search the web:" },
      ]);
      return q.trim() ? { kind: "message", text: `search the web for: ${q.trim()}` } : { kind: "handled" };
    }

    case "/news": {
      const { q } = await inquirer.prompt<{ q: string }>([
        { type: "input", name: "q", message: "Search news:" },
      ]);
      return q.trim() ? { kind: "message", text: `search for recent news about: ${q.trim()}` } : { kind: "handled" };
    }

    case "/inbox":
      return { kind: "message", text: "check my gmail inbox" };

    case "/repos":
      return { kind: "message", text: "list my github repositories" };

    case "/prs":
      return {
        kind: "message",
        text: "show my open pull requests on github",
      };

    case "/issues":
      return {
        kind: "message",
        text: "show github issues assigned to me",
      };

    default:
      // Unknown /command — strip slash and send as message
      return { kind: "message", text: input.slice(1).trim() };
  }
}
