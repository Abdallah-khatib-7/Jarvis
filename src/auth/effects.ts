import chalk from "chalk";
import gradient from "gradient-string";
import ansiEscapes from "ansi-escapes";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function termCols(): number {
  return process.stdout.columns || 80;
}

function center(line: string): string {
  const pad = Math.max(0, Math.floor((termCols() - line.length) / 2));
  return " ".repeat(pad) + line;
}

/* a real 10-second countdown; caller decides what happens at zero */
export async function selfDestruct(): Promise<void> {
  process.stdout.write(ansiEscapes.cursorHide);

  console.log(
    chalk.red.bold(
      center("\n⚠  SELF-DESTRUCT SEQUENCE INITIATED  ⚠\n")
    )
  );
  await sleep(700);

  for (let n = 10; n >= 1; n--) {
    const bar = "█".repeat(n) + "░".repeat(10 - n);
    const line = `${chalk.red.bold(n.toString().padStart(2))}  ${chalk.red(bar)}`;

    process.stdout.write(ansiEscapes.eraseLine + ansiEscapes.cursorTo(0));
    process.stdout.write(center(line));
    await sleep(1000);
  }

  process.stdout.write("\n\n");
  console.log(chalk.red.bold(center("BOOM.\n")));
  await sleep(900);
  process.stdout.write(ansiEscapes.cursorShow);
}

/* calm, respectful farewell for users under the age limit */
export async function underageFarewell(): Promise<void> {
  process.stdout.write(ansiEscapes.cursorHide);
  console.log("\n");

  const lines = [
    gradient(["#00c6ff", "#0072ff"]).multiline(
      center("Some doors open with time.")
    ),
    "",
    chalk.cyan(center("You're a little early for this one.")),
    chalk.dim(center("Come back when you're 16.")),
    "",
    chalk.dim.italic(
      center('"The future belongs to those who prepare for it." — Malcolm X')
    ),
  ];

  for (const line of lines) {
    console.log(line);
    await sleep(450);
  }

  console.log("\n");
  await sleep(800);
  process.stdout.write(ansiEscapes.cursorShow);
}