import ora, { type Ora } from "ora";
import chalk from "chalk";

/* rotating phrases so long waits don't feel frozen; Claude-Code-style flavor */
const PHRASES = [
  "Studying you",
  "Contemplating",
  "Connecting the dots",
  "Tinkering",
  "Forming an impression",
];

/* runs async work behind a live spinner; swaps phrases while it waits */
export async function withThinking<T>(
  work: () => Promise<T>,
  opening = "Studying you"
): Promise<T> {
  const spinner: Ora = ora({
    text: chalk.cyan(opening),
    spinner: "dots",
    color: "cyan",
  }).start();

  let i = 0;
  const rotator = setInterval(() => {
    i = (i + 1) % PHRASES.length;
    spinner.text = chalk.cyan(PHRASES[i] + "...");
  }, 1400);

  try {
    const result = await work();
    spinner.stop();
    return result;
  } catch (err) {
    spinner.fail(chalk.red("Something went wrong."));
    throw err;
  } finally {
    clearInterval(rotator);
  }
}