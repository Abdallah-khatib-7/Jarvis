import ora, { type Ora } from "ora";
import chalk from "chalk";

const PHRASES = [
  "Studying you",
  "Contemplating",
  "Connecting the dots",
  "Tinkering",
  "Forming an impression",
];

let _spinner: Ora | null = null;
let _rotator: ReturnType<typeof setInterval> | null = null;

/* called by tools that need to write to the terminal or prompt the user */
export function stopThinking(): void {
  if (_rotator) { clearInterval(_rotator); _rotator = null; }
  _spinner?.stop();
  _spinner = null;
}

export async function withThinking<T>(
  work: () => Promise<T>,
  opening = "Studying you"
): Promise<T> {
  _spinner = ora({
    text: chalk.cyan(opening),
    spinner: "dots",
    color: "cyan",
  }).start();

  let i = 0;
  _rotator = setInterval(() => {
    i = (i + 1) % PHRASES.length;
    if (_spinner) _spinner.text = chalk.cyan(PHRASES[i] + "...");
  }, 1400);

  try {
    const result = await work();
    stopThinking();
    return result;
  } catch (err) {
    _spinner?.fail(chalk.red("Something went wrong."));
    _spinner = null;
    throw err;
  } finally {
    if (_rotator) { clearInterval(_rotator); _rotator = null; }
  }
}
