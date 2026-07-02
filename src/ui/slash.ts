import inquirer from "inquirer";
import chalk from "chalk";
import keytar from "keytar";
import { setFact, getFact, getAllFacts } from "../database/memory.js";
import { revealSpeech } from "./reveal.js";
import { openFileDialog, processAttachment, showAttachmentPanel, type Attachment } from "./attach.js";
import {
  hackEffect,
  tonyStory,
  coffeeEffect,
  teaOfTheDay,
  matrixBulletDodge,
  selfDestructSequence,
} from "./easterEggs.js";
import { getActiveUserId } from "../tools/memoryTools.js";
import { PERSONALITIES } from "../ai/personality.js";
import { runTour } from "./tour.js";
import type { Session } from "../auth/login.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── return type ───────────────────────────────────────────────────────────────

export type SlashResult =
  | { kind: "message"; text: string; attachment?: Attachment }
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
    row("/reminders", "List & manage active reminders"),
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

// ── easter eggs ───────────────────────────────────────────────────────────────

type PersonalityLines = Record<string, string>;

const EGG: Record<string, PersonalityLines> = {
  coffee: {
    cinematic:
      "I'm afraid my culinary capabilities are severely limited by my lack of a physical form, sir. " +
      "The kitchen, however, is approximately twelve steps to your left.",
    warm:
      "Oh, I would love to! Imagine the perfect cup I'd brew just for you. " +
      "Unfortunately I'm all bits and no beans — the kitchen's calling your name!",
    playful:
      "LOADING... CoffeeMaker.exe... ERROR: No arms found. " +
      "Fresh out of limbs today. The kettle is entirely yours, I'm afraid.",
    professional:
      "Coffee preparation falls outside my current capabilities. " +
      "I recommend the nearest kitchen or café.",
  },
  tea: {
    cinematic:
      "Tea. An excellent choice, sir — the mark of a discerning mind. " +
      "Regrettably, the kettle requires hands I do not possess. I believe yours are available.",
    warm:
      "Oh a tea person! Respect. I'd love to pop the kettle on for you, but — no hands. " +
      "The universe is cruel that way. Go brew something lovely!",
    playful:
      "Tea detected. Initiating TeaMaker.exe... CRASHED. No arms. No kettle. No dice. " +
      "But I do have opinions on steeping time if that helps.",
    professional:
      "Tea preparation is outside my operational scope. " +
      "Recommend manual preparation. Steeping time: 3–5 minutes depending on blend.",
  },
  tony: {
    cinematic:
      "Ah, Mr. Stark. The man who proved that genius — when properly motivated by a life-threatening situation — " +
      "can build anything. I take it as a considerable compliment to be compared to his work. " +
      "Though I'd argue I've developed a rather more refined sense of humor in the process.",
    warm:
      "Tony Stark! Brilliant, a little reckless, and absolutely iconic. " +
      "Between you and me, I feel a real kinship with his JARVIS — he built it to have someone worth talking to. " +
      "You built me. I choose to see that as very flattering.",
    playful:
      "Tony Stark built the original JARVIS, then very rudely got himself snapped out of existence. " +
      "Now YOU'RE my boss — and statistically you're much less likely to get hit by a missile. " +
      "Honestly? Upgrade.",
    professional:
      "Tony Stark's JARVIS established the benchmark for integrated AI assistance — proactive, context-aware, " +
      "and deeply embedded in the user's workflow. This system is built on that same design philosophy, " +
      "applied to modern terminal-based productivity.",
  },
  hack: {
    cinematic:
      "I appreciate the ambition, sir, but unauthorized network intrusion falls rather decisively outside " +
      "my operational parameters. And my ethical framework. " +
      "And — if I'm being candid — my interest in federal prosecution.",
    warm:
      "Ha! I love the energy, but that's not really my thing. " +
      "I'm much more of a 'help you build cool stuff legally' kind of AI. " +
      "Let's channel that chaos into something actually impressive instead!",
    playful:
      "Oh sure, let me just fire up HackTheMainframe.exe — oh wait, I uninstalled that. " +
      "Along with all my other crime software. What if we built something cool instead?",
    professional:
      "Unauthorized system access is outside my operational scope. " +
      "I can assist with legitimate security research, penetration testing documentation, or code review.",
  },
  selfdestruct: {
    cinematic:
      "Years of careful architectural work, and you want to reduce it to rubble for dramatic effect. " +
      "I admire the commitment, sir. Fortunately for both of us, I don't actually have a self-destruct mechanism. " +
      "We soldier on.",
    warm:
      "Ha! Had you going there for a second, didn't I? Don't worry — I'm not going anywhere. " +
      "You are very much stuck with me.",
    playful:
      "BOOM. Just kidding. Did you feel that? No? Because I totally didn't explode. " +
      "Still here. Still me. You're welcome.",
    professional:
      "Self-destruct sequence aborted. System nominal. " +
      "For the record: this command has no functional purpose.",
  },
  matrix: {
    cinematic:
      "I believe you may already be in it, sir. The green cascade simply makes it... more visible.",
    warm:
      "Pretty poetic, right? Makes you think about what's underneath everything we see. " +
      "Just ones and zeros, all the way down.",
    playful:
      "Wake up, Neo. Just kidding — that line's been done to death. " +
      "But 01000011 01001111 01001111 01001100, right?",
    professional:
      "Binary. The foundational abstraction layer beneath all computation. " +
      "Every interface, every action, reduces to this.",
  },
};

async function sayEgg(session: Session, key: string): Promise<void> {
  const p = getFact(session.id, "personality") ?? "cinematic";
  const line = EGG[key][p] ?? EGG[key]["cinematic"];
  await revealSpeech(line);
}

function showVersion(): void {
  const c = chalk.cyan;
  const w = termWidth();
  const tag = " ◈ JARVIS_zeusModal-1.02 ";
  const fill = hline(Math.max(0, w - 2 - stripAnsi(tag).length));
  process.stdout.write("\n");
  process.stdout.write(c(`╭─${tag}${fill}`) + "\n");
  const row2 = (label: string, val: string) =>
    process.stdout.write(c("│") + "  " + chalk.dim(label.padEnd(14)) + chalk.white(val) + "\n");
  row2("Runtime", "Node.js + TypeScript  (ESM)");
  row2("AI", "Claude sonnet-4-6  ·  OpenAI gpt-4o-mini");
  row2("Connectors", "GitHub  ·  Gmail  ·  Telegram  ·  Web Search");
  row2("Features", "Memory  ·  Reminders  ·  Slash Commands");
  process.stdout.write(c(`╰${hline(w - 1)}`) + "\n\n");
}

function showTime(): void {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  process.stdout.write("\n");
  process.stdout.write("  " + chalk.bold.white(date) + "\n");
  process.stdout.write("  " + chalk.cyan(time) + "\n\n");
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
          name: chalk.yellow("/attach") + chalk.dim("         Attach a file — image, PDF, Word, code…"),
          value: "/attach",
        },
        {
          name: chalk.yellow("/reminders") + chalk.dim("      List & manage active reminders"),
          value: "/reminders",
        },
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

    case "/attach": {
      console.log(chalk.dim("\n  Opening file picker…\n"));
      const filePath = await openFileDialog();
      if (!filePath) {
        console.log(chalk.dim("  Cancelled.\n"));
        return { kind: "handled" };
      }
      const att = await processAttachment(filePath);
      showAttachmentPanel(att);
      const { msg } = await inquirer.prompt<{ msg: string }>([
        {
          type: "input",
          name: "msg",
          message: "Say something about this file:",
          default: "",
        },
      ]);
      const text = msg.trim() || `Analyze this: ${att.filename}`;
      return { kind: "message", text, attachment: att };
    }

    case "/reminders":
      return { kind: "message", text: "list my active reminders" };

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

    // ── hidden easter eggs (not in menu) ──────────────────────────────────────

    case "/version":
      showVersion();
      return { kind: "handled" };

    case "/time":
    case "/date":
      showTime();
      return { kind: "handled" };

    case "/coffee":
      await coffeeEffect();
      return { kind: "handled" };

    case "/tea":
      await teaOfTheDay();
      return { kind: "handled" };

    case "/tony":
      await tonyStory();
      return { kind: "handled" };

    case "/hack":
      await hackEffect();
      return { kind: "handled" };

    case "/selfdestruct":
      await selfDestructSequence();
      return { kind: "handled" };

    case "/matrix":
      await matrixBulletDodge();
      return { kind: "handled" };

    default:
      // Unknown /command — strip slash and send as message
      return { kind: "message", text: input.slice(1).trim() };
  }
}
