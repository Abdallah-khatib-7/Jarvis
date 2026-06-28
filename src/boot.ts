import figlet from "figlet";
import gradient from "gradient-string";
import boxen from "boxen";
import chalk from "chalk";
import ansiEscapes from "ansi-escapes";

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#________";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomChar(): string {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
}

function termCols(): number {
  return process.stdout.columns || 80;
}

/* pad a single line to sit in the terminal's horizontal center */
function center(line: string): string {
  const pad = Math.max(0, Math.floor((termCols() - line.length) / 2));
  return " ".repeat(pad) + line;
}

/* center a block against its widest line so the shape stays intact */
function centerBlock(lines: string[]): string[] {
  const widest = Math.max(...lines.map((l) => l.length));
  const pad = " ".repeat(Math.max(0, Math.floor((termCols() - widest) / 2)));
  return lines.map((l) => pad + l);
}

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
  const paint = gradient(["#00c6ff", "#0072ff"]);

  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const frame = glitchFrame(lines, i / steps);
    process.stdout.write(ansiEscapes.cursorTo(0, 0) + ansiEscapes.eraseDown);
    process.stdout.write(paint.multiline(frame));
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
  const pad = Math.max(0, Math.floor((termCols() - text.length) / 2));
  const lead = " ".repeat(pad);

  process.stdout.write(lead);
  for (const ch of text) {
    process.stdout.write(chalk.cyanBright(ch));
    await sleep(45);
  }
  process.stdout.write("\n\n");
}

export async function showBoot(): Promise<void> {
  process.stdout.write(ansiEscapes.cursorHide);

  await glitchTitle();
  await bootStatus();
  await typeTagline("Just A Rather Very Intelligent System");

  process.stdout.write(ansiEscapes.cursorShow);
}