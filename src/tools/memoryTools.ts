import chalk from "chalk";
import { setFact, getAllFacts, deleteFact } from "../database/memory.js";
import { stopThinking } from "../ui/thinking.js";
import type { ToolResult } from "./fileTools.js";

// ── active user (set by loop.ts at session start) ────────────────────────────

let _userId: number | null = null;

export function setActiveUser(userId: number): void {
  _userId = userId;
}

export function getActiveUserId(): number | null {
  return _userId;
}

// ── panel UI ─────────────────────────────────────────────────────────────────

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function memoryPanel(label: string, body: string): void {
  const w = termWidth();
  const tag = ` ◈ ${label} `;
  const fill = "─".repeat(Math.max(0, w - 2 - stripAnsi(tag).length));

  process.stdout.write("\n");
  process.stdout.write(chalk.magenta(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(chalk.magenta("│") + "  " + body + "\n");
  process.stdout.write(chalk.dim(`╰${"─".repeat(w - 1)}`) + "\n");
}

// ── tools ─────────────────────────────────────────────────────────────────────

export async function rememberTool(key: string, value: string): Promise<ToolResult> {
  if (_userId === null) return { ok: false, output: "No active session." };

  setFact(_userId, key, value);

  stopThinking();
  memoryPanel(
    "MEMORY",
    chalk.magenta(key) + chalk.dim("  →  ") + chalk.white(value)
  );
  process.stdout.write(chalk.green("   ✓  Noted.\n\n"));

  return { ok: true, output: `Stored: ${key} = "${value}"` };
}

export async function forgetTool(key: string): Promise<ToolResult> {
  if (_userId === null) return { ok: false, output: "No active session." };

  const removed = deleteFact(_userId, key);
  if (!removed) {
    return { ok: false, output: `No memory found with key "${key}".` };
  }

  stopThinking();
  memoryPanel("FORGET", chalk.dim(key));
  process.stdout.write(chalk.green("   ✓  Forgotten.\n\n"));

  return { ok: true, output: `Forgot "${key}".` };
}

/* no UI — just returns raw facts so the AI can reason over them */
export async function recallTool(): Promise<ToolResult> {
  if (_userId === null) return { ok: false, output: "No active session." };

  const facts = getAllFacts(_userId);
  if (facts.length === 0) {
    return { ok: true, output: "No facts stored yet." };
  }

  return {
    ok: true,
    output: facts.map((f) => `${f.key}: ${f.value}`).join("\n"),
  };
}
