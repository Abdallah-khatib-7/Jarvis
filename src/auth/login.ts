import inquirer from "inquirer";
import chalk from "chalk";
import {
  userExists,
  createUser,
  verifyUser,
  getUserId,
} from "../database/users.js";
import { askText, askPassword } from "./prompts.js";
import { panel, warn, fail, termWidth, hline, center, brand } from "../ui/hud.js";

export interface Session {
  id: number;
  username: string;
  isNew: boolean;
}

const BACK = Symbol("back");
type Outcome = Session | typeof BACK;

const backHint = chalk.dim('(type "back" to return, "exit" to quit)');

/* blank line helper; keeps the flow from feeling cramped */
function gap(): void {
  console.log("");
}

function authHeader(): void {
  const w = termWidth();
  console.log(brand(hline(w)));
  console.log(brand(center("◈  JARVIS ACCESS TERMINAL  ◈", w)));
  console.log(brand(hline(w)));
  console.log(chalk.dim.italic(center("Voice authentication unavailable — falling back to credentials.", w)) + "\n");
}

async function signUp(): Promise<Outcome> {
  while (true) {
    const username = await askText(
      `Choose a username: ${backHint}`,
      (v) => v.trim().length > 0 || "Username cannot be empty."
    );

    if (username.trim().toLowerCase() === "back") return BACK;

    if (userExists(username)) {
      console.log(warn("That name is taken. Try another.\n"));
      continue;
    }

    const password = await askNewPassword();

    const id = createUser(username, password);
    panel(
      { icon: "◈", title: "NEW PROFILE", color: chalk.green },
      [chalk.white(`Account created. Welcome, ${chalk.bold(username)}.`)]
    );
    return { id, username, isNew: true };
  }
}

/* asks twice and only returns once both entries match */
async function askNewPassword(): Promise<string> {
  while (true) {
    const password = await askPassword("Set a password (min 4 chars):");

    if (password.length < 4) {
      console.log(warn("Use at least 4 characters.\n"));
      continue;
    }

    const confirm = await askPassword("Re-enter password:");

    if (password === confirm) return password;
    console.log(warn("Passwords don't match. Try again.\n"));
  }
}

async function signIn(): Promise<Outcome | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const username = await askText(`Username: ${backHint}`);

    if (username.trim().toLowerCase() === "back") return BACK;

    if (!userExists(username)) {
      console.log(warn("No such user.\n"));
      continue;
    }

    const password = await askPassword("Password:");

    if (verifyUser(username, password)) {
      const id = getUserId(username)!;
      panel(
        { icon: "◈", title: "ACCESS GRANTED", color: chalk.green },
        [chalk.white(`Welcome back, ${chalk.bold(username)}.`)]
      );
      return { id, username , isNew: false };
    }

    const left = 3 - attempt;
    console.log(
      fail(`Wrong password.${left > 0 ? ` ${left} attempt(s) left.` : ""}\n`)
    );
  }

  panel(
    { icon: "✗", title: "ACCESS DENIED", color: chalk.red },
    [chalk.white("Too many failed attempts. Connection terminated.")]
  );
  return null;
}

export async function authenticate(): Promise<Session | null> {
  authHeader();

  while (true) {
    gap();
    const { choice } = await inquirer.prompt<{ choice: string }>([
      {
        type: "select",
        name: "choice",
        message: "Is this your first time?",
        choices: [
          { name: "I'm new here", value: "new" },
          { name: "I've been here before", value: "returning" },
        ],
      },
    ]);

    const result = choice === "new" ? await signUp() : await signIn();

    if (result === BACK) continue;
    return result;
  }
}