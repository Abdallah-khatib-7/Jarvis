import { exec, type ExecException } from "node:child_process";
import { resolve } from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";
import { stopThinking } from "../ui/thinking.js";
import type { ToolResult } from "./fileTools.js";

const EXEC_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 6_000;

/* strip ANSI escape codes so the AI receives clean text */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, "");
}

function runShell(command: string, cwd: string): Promise<{ output: string; exitCode: number }> {
  return new Promise((res) => {
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    exec(
      command,
      { cwd, timeout: EXEC_TIMEOUT_MS, shell, maxBuffer: 10 * 1024 * 1024 },
      (err: ExecException | null, stdout: Buffer | string, stderr: Buffer | string) => {
        const raw = [
          Buffer.isBuffer(stdout) ? stdout.toString("utf-8") : (stdout as string),
          Buffer.isBuffer(stderr) ? stderr.toString("utf-8") : (stderr as string),
        ]
          .filter(Boolean)
          .join("\n")
          .trim();

        let output = stripAnsi(raw || "(no output)");
        if (output.length > MAX_OUTPUT_CHARS) {
          output =
            output.slice(0, MAX_OUTPUT_CHARS) +
            `\n\n... (truncated — ${output.length} chars total)`;
        }
        const exitCode = err
          ? typeof err.code === "number"
            ? err.code
            : 1
          : 0;
        res({ output, exitCode });
      }
    );
  });
}

/* whitelist of commands that read state without modifying anything */
function isSafe(command: string): boolean {
  const parts = command.trim().split(/\s+/);
  const base = parts[0].toLowerCase().replace(/\.cmd$|\.exe$/, "");
  const sub = parts[1]?.toLowerCase();

  switch (base) {
    case "tsc":
    case "npx":
    case "jest":
    case "vitest":
    case "ls":
    case "dir":
    case "echo":
    case "pwd":
    case "which":
    case "where":
    case "type": // Windows equivalent of cat
      return true;
    case "node":
      // allow running a specific file, not interactive REPL
      return parts.length >= 2 && !parts.includes("-e") && !parts.includes("--eval");
    case "npm":
      return ["test", "run", "ls", "list", "info", "version", "start"].includes(sub ?? "");
    case "git":
      return ["status", "log", "diff", "branch", "show", "stash"].includes(sub ?? "");
    default:
      return false;
  }
}

async function confirmDestructive(command: string): Promise<boolean> {
  const phrase = `run: ${command}`;

  stopThinking();
  process.stdout.write("\n");
  process.stdout.write(
    chalk.yellow("  ⚠  This command may modify files or your system.\n\n")
  );
  process.stdout.write(chalk.dim(`     $ ${command}\n\n`));
  process.stdout.write(
    chalk.white("  To authorize, type exactly: ") +
      chalk.cyanBright(phrase) +
      "\n"
  );
  process.stdout.write(chalk.dim("  (anything else cancels)\n\n"));

  const { answer } = await inquirer.prompt<{ answer: string }>([
    { type: "input", name: "answer", message: chalk.white("→") },
  ]);

  const confirmed = answer.trim() === phrase;
  if (!confirmed) {
    process.stdout.write(chalk.dim("\n  Cancelled.\n\n"));
  }
  return confirmed;
}

export async function executeCommandTool(command: string): Promise<ToolResult> {
  const cwd = resolve(".");

  if (!isSafe(command)) {
    const confirmed = await confirmDestructive(command);
    if (!confirmed) {
      return { ok: false, output: "Command cancelled by user." };
    }
  }

  const { output, exitCode } = await runShell(command, cwd);
  const prefix = exitCode !== 0 ? `Exit code: ${exitCode}\n\n` : "";
  return { ok: exitCode === 0, output: prefix + output };
}
