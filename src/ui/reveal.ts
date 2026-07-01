import chalk from "chalk";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* wraps long text to the terminal width so it doesn't run off screen */
function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* types text out line by line, character by character; the "JARVIS speaking" effect */
export async function revealSpeech(
  text: string,
  speedMs = 18
): Promise<void> {
  const cols = process.stdout.columns || 80;
  const width = Math.min(cols - 4, 90);
  const lines = wrap(text.trim(), width);

  console.log("");
  for (const line of lines) {
    for (const ch of line) {
      process.stdout.write(chalk.cyanBright(ch));
      await sleep(speedMs);
    }
    process.stdout.write("\n");
  }
  console.log("");
}