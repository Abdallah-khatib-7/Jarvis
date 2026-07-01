import chalk from "chalk";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function typeLine(line: string, speedMs: number): Promise<void> {
  for (const ch of line) {
    process.stdout.write(chalk.blue(ch));
    await sleep(speedMs);
  }
  process.stdout.write("\n");
}

/* code blocks print instantly and untouched; only prose gets the typewriter treatment */
export async function revealSpeech(
  text: string,
  speedMs = 4
): Promise<void> {
  const cols = process.stdout.columns || 80;
  const width = Math.min(cols - 4, 90);

  console.log("");

  const segments = text.trim().split(/(```[\s\S]*?```)/g);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    if (segment.startsWith("```")) {
      console.log(chalk.gray(segment));
      continue;
    }

    for (const line of wrap(segment.trim(), width)) {
      await typeLine(line, speedMs);
    }
  }

  console.log("");
}