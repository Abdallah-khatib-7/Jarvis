import chalk from "chalk";
import { setFact } from "../database/memory.js";
import { askText } from "./prompts.js";
import type { Session } from "./login.js";

/* the fixed seed questions; key is how the fact is stored in memory */
const QUESTIONS: { key: string; prompt: string }[] = [
  { key: "preferred_name", prompt: "What should I call you?" },
  { key: "role", prompt: "What do you do?" },
  { key: "building", prompt: "What are you working on these days?" },
];

/* runs once, right after signup; writes each answer into memory */
export async function runOnboarding(session: Session): Promise<void> {
  console.log(
    chalk.cyan("\nBefore we begin, let me get to know you a little.\n")
  );

  for (const q of QUESTIONS) {
    const answer = await askText(q.prompt);

    /* skip empties so we don't store blank facts */
    if (answer.trim().length > 0) {
      setFact(session.id, q.key, answer.trim());
    }
  }

  console.log(chalk.green("\nGot it. I'll remember that.\n"));
}