import figlet from "figlet";
import chalk from "chalk";
import ansiEscapes from "ansi-escapes";
import { sleep, centerBlock, center, brand, hideCursor, showCursor } from "./ui/hud.js";

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#________";

function randomChar(): string {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
}

// ── arc-reactor power-up ─────────────────────────────────────────────────────
// Procedurally generated so the ring is always a clean circle — no hand-aligned
// ASCII to drift out of shape on a re-edit. Aspect-corrected for terminal cells.

function buildReactor(radius: number): string[] {
  const lines: string[] = [];
  for (let y = -radius; y <= radius; y++) {
    let line = "";
    for (let x = -radius * 2; x <= radius * 2; x++) {
      const dx = x / 2;
      const dist = Math.sqrt(dx * dx + y * y);
      if (dist > radius) line += "  ";
      else if (dist > radius - 1) line += ".  ";
      else if (dist > radius - 2.1) line += "o  ";
      else if (dist > radius - 3.1) line += "O  ";
      else line += "@  ";
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

const REACTOR = buildReactor(4);

async function arcReactorPowerUp(): Promise<void> {
  const lines = centerBlock(REACTOR);
  const stages: ((l: string) => string)[] = [
    (l) => chalk.gray.dim(l),
    (l) => chalk.blue(l),
    (l) => chalk.cyan(l),
    (l) => chalk.whiteBright(l),
    (l) => brand(l),
  ];

  for (const paint of stages) {
    process.stdout.write(ansiEscapes.cursorTo(0, 0) + ansiEscapes.eraseDown);
    process.stdout.write("\n" + lines.map(paint).join("\n") + "\n");
    await sleep(130);
  }
  await sleep(350);
  process.stdout.write(ansiEscapes.cursorTo(0, 0) + ansiEscapes.eraseDown);
}

// ── glitch title reveal ───────────────────────────────────────────────────────

function glitchFrame(lines: string[], progress: number): string {
  return lines
    .map((line) =>
      line
        .split("")
        .map((ch) => {
          if (ch === " ") return " ";
          return Math.random() < progress ? ch : randomChar();
        })
        .join("")
    )
    .join("\n");
}

async function glitchTitle(): Promise<void> {
  const title = figlet.textSync("JARVIS", {
    font: "Standard",
    horizontalLayout: "full",
  });
  const lines = centerBlock(title.split("\n"));

  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const frame = glitchFrame(lines, i / steps);
    process.stdout.write(ansiEscapes.cursorTo(0, 0) + ansiEscapes.eraseDown);
    process.stdout.write(brand.multiline(frame));
    await sleep(55);
  }
  process.stdout.write("\n\n");
}

/* system-style startup lines; each resolves with a green check */
async function bootStatus(): Promise<void> {
  const steps = ["CORE ONLINE", "MEMORY LINKED", "TOOLS ARMED", "SYSTEMS NOMINAL"];

  for (const label of steps) {
    const line = `${chalk.green("✓")} ${chalk.cyan(label)}`;
    console.log(center(line));
    await sleep(280);
  }
  process.stdout.write("\n");
}

/* typewriter reveal, centered as a whole so it doesn't drift while typing */
async function typeTagline(text: string): Promise<void> {
  const pad = Math.max(0, Math.floor((process.stdout.columns || 80) - text.length) / 2);
  process.stdout.write(" ".repeat(Math.floor(pad)));
  for (const ch of text) {
    process.stdout.write(chalk.cyanBright(ch));
    await sleep(45);
  }
  process.stdout.write("\n\n");
}

export async function showBoot(): Promise<void> {
  hideCursor();

  await arcReactorPowerUp();
  await glitchTitle();
  await bootStatus();
  await typeTagline("Just A Rather Very Intelligent System");

  showCursor();
}
