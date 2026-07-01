import chalk, { type ChalkInstance } from "chalk";
import { setFact, getFact } from "../database/memory.js";
import type { Session } from "../auth/login.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function hline(n: number): string {
  return "─".repeat(Math.max(0, n));
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function section(
  icon: string,
  title: string,
  body: string[],
  color: ChalkInstance
): void {
  const w = termWidth();
  const tag = `  ${icon}  ${title}  `;
  const fill = hline(Math.max(0, w - 2 - stripAnsi(tag).length));

  process.stdout.write(color(`╭─${tag}${fill}`) + "\n");
  for (const line of body) {
    if (line === "") {
      process.stdout.write(color("│") + "\n");
    } else {
      process.stdout.write(color("│") + "  " + line + "\n");
    }
  }
  process.stdout.write(color(`╰${hline(w - 1)}`) + "\n\n");
}

export function isFirstRun(session: Session): boolean {
  return !getFact(session.id, "first_run_done");
}

export async function runTour(session: Session): Promise<void> {
  const w = termWidth();

  process.stdout.write("\n");

  // ── Header ─────────────────────────────────────────────────────────────────
  const banner = "  ◈  WELCOME TO JARVIS  ◈  ";
  const pad = Math.max(0, Math.floor((w - banner.length) / 2));
  process.stdout.write(chalk.cyan(hline(w)) + "\n");
  process.stdout.write(chalk.cyan(" ".repeat(pad) + banner) + "\n");
  process.stdout.write(chalk.cyan(hline(w)) + "\n\n");
  process.stdout.write(chalk.dim("  Your personal AI assistant, running in your terminal.\n"));
  process.stdout.write(chalk.dim("  Here's everything I can do for you.\n\n"));

  await sleep(350);

  // ── Files & Code ───────────────────────────────────────────────────────────
  section("◉", "FILES & CODE", [
    chalk.white("Read, edit, create and delete files. Run shell commands. Fix bugs on the spot."),
    "",
    chalk.dim(`"read my tsconfig"`) +
      "    " +
      chalk.dim(`"fix the error in app.ts"`) +
      "    " +
      chalk.dim(`"run npm test"`),
  ], chalk.green);

  await sleep(220);

  // ── Memory ─────────────────────────────────────────────────────────────────
  section("◈", "MEMORY", [
    chalk.white("I remember things between sessions — your name, stack, preferences, projects."),
    chalk.white("Everything I learn is stored and loaded the next time you log in."),
    "",
    chalk.dim(`"remember I use tabs"`) +
      "    " +
      chalk.dim(`"what do you know about me?"`) +
      "    " +
      chalk.dim(`"forget my job_title"`),
  ], chalk.magenta);

  await sleep(220);

  // ── GitHub ─────────────────────────────────────────────────────────────────
  section("◎", "GITHUB", [
    chalk.white("List repos, read any file, manage issues, PRs, and CI workflow runs."),
    chalk.white("Your token is stored securely in the OS credential store — asked once only."),
    "",
    chalk.dim(`"show my open PRs"`) +
      "    " +
      chalk.dim(`"create an issue: add dark mode"`) +
      "    " +
      chalk.dim(`"trigger the deploy workflow"`),
  ], chalk.white);

  await sleep(220);

  // ── Gmail ──────────────────────────────────────────────────────────────────
  section("◇", "GMAIL", [
    chalk.white("Read, search, and send emails directly from your Gmail account."),
    chalk.white("Uses an App Password — no browser sign-in or OAuth required."),
    "",
    chalk.dim(`"check my inbox"`) +
      "    " +
      chalk.dim(`"any unread from Ahmed?"`) +
      "    " +
      chalk.dim(`"email John about the delay"`),
  ], chalk.red);

  await sleep(220);

  // ── Telegram ───────────────────────────────────────────────────────────────
  section("◁", "TELEGRAM", [
    chalk.white("Send messages and files straight to your phone via a Telegram bot."),
    chalk.white("Perfect for build results, long-running task alerts, and forwarding reports."),
    "",
    chalk.dim(`"send me a summary when tests finish"`) +
      "    " +
      chalk.dim(`"forward this log to my phone"`),
  ], chalk.cyan);

  await sleep(220);

  // ── Slash Commands ─────────────────────────────────────────────────────────
  const tag = "  ⚡  SLASH COMMANDS  ";
  const fill = hline(Math.max(0, w - 2 - tag.length));

  process.stdout.write(chalk.yellow(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(
    chalk.yellow("│") +
      "  " +
      chalk.white("Type  ") +
      chalk.bold.yellow("/") +
      chalk.white("  at any time to open the command menu — browse everything, no typing needed.") +
      "\n"
  );
  process.stdout.write(chalk.yellow("│") + "\n");

  const pairs: [string, string][] = [
    ["/connect", "set up services"],
    ["/memory", "see your stored facts"],
    ["/inbox", "open Gmail inbox"],
    ["/repos", "browse GitHub repos"],
    ["/help", "full command reference"],
    ["/clear", "fresh conversation"],
  ];

  for (let i = 0; i < pairs.length; i += 2) {
    const left =
      chalk.bold.yellow(pairs[i][0].padEnd(14)) + chalk.dim(pairs[i][1]);
    const right =
      i + 1 < pairs.length
        ? chalk.bold.yellow(pairs[i + 1][0].padEnd(14)) +
          chalk.dim(pairs[i + 1][1])
        : "";
    process.stdout.write(
      chalk.yellow("│") + "  " + left + "   " + chalk.dim("│") + "   " + right + "\n"
    );
  }

  process.stdout.write(chalk.yellow(`╰${hline(w - 1)}`) + "\n\n");

  // ── Footer ─────────────────────────────────────────────────────────────────
  const foot = "Ready. What would you like to do?";
  const footPad = Math.max(0, Math.floor((w - foot.length) / 2));
  process.stdout.write(chalk.dim(" ".repeat(footPad) + foot) + "\n\n");

  setFact(session.id, "first_run_done", "true");
}
