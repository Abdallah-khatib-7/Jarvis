import inquirer from "inquirer";
import chalk from "chalk";

/* global escape hatch: any text prompt honors exit/quit */
function checkExit(value: string): void {
  const v = value.trim().toLowerCase();
  if (v === "exit" || v === "quit") {
    console.log(chalk.cyan("\nJARVIS powering down. Goodbye.\n"));
    process.exit(0);
  }
}

export async function askText(
  message: string,
  validate?: (v: string) => true | string
): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    { type: "input", name: "value", message, validate },
  ]);
  checkExit(value);
  return value;
}

export async function askPassword(message: string): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    { type: "password", name: "value", mask: "*", message },
  ]);
  checkExit(value);
  return value;
}

export async function askRaw(message: string): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    { type: "input", name: "value", message },
  ]);
  const v = value.trim().toLowerCase();
  if (v === "exit" || v === "quit") {
    console.log(chalk.cyan("\nJARVIS powering down. Goodbye.\n"));
    process.exit(0);
  }
  return value.trim();
}

export async function askChoice(
  message: string,
  choices: { name: string; value: string }[]
): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    { type: "select", name: "value", message, choices },
  ]);
  return value;
}

  export async function askConfirm(message: string): Promise<boolean> {
  const { value } = await inquirer.prompt<{ value: boolean }>([
    { type: "confirm", name: "value", message },
  ]);
  return value;
}