import { readFile, writeFile, unlink, access, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import chalk, { type ChalkInstance } from "chalk";
import inquirer from "inquirer";
import { stopThinking } from "../ui/thinking.js";
import { isSessionApproved, approveSession } from "./permissions.js";
import type { ToolResult } from "./fileTools.js";

// ── terminal helpers ─────────────────────────────────────────────────────────

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function hline(char = "─", width = termWidth()): string {
  return char.repeat(Math.max(0, width));
}

// ── panel rendering ──────────────────────────────────────────────────────────

function panelHeader(icon: string, label: string, path: string, color: ChalkInstance): void {
  const w = termWidth();
  const tag = ` ${icon} ${label} `;
  const fill = hline("─", Math.max(0, w - 2 - stripAnsi(tag).length));

  process.stdout.write("\n");
  process.stdout.write(color(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(color("│") + "  " + chalk.bold.white(path) + "\n");
  process.stdout.write(chalk.dim(`╰${hline("─", w - 1)}`) + "\n\n");
}

// ── diff display ─────────────────────────────────────────────────────────────

const DIFF_CAP = 28;

function renderDiff(oldLines: string[], newLines: string[], startLine: number): void {
  const showOld = oldLines.slice(0, DIFF_CAP);
  const showNew = newLines.slice(0, DIFF_CAP);

  for (let i = 0; i < showOld.length; i++) {
    const n = chalk.dim(String(startLine + i).padStart(5));
    process.stdout.write(chalk.red("  - ") + n + chalk.dim(" │") + chalk.red("  " + showOld[i]) + "\n");
  }
  if (oldLines.length > DIFF_CAP) {
    process.stdout.write(chalk.red(`     … ${oldLines.length - DIFF_CAP} more lines\n`));
  }

  process.stdout.write("\n");

  for (let i = 0; i < showNew.length; i++) {
    const n = chalk.dim(String(startLine + i).padStart(5));
    process.stdout.write(chalk.green("  + ") + n + chalk.dim(" │") + chalk.green("  " + showNew[i]) + "\n");
  }
  if (newLines.length > DIFF_CAP) {
    process.stdout.write(chalk.green(`     … ${newLines.length - DIFF_CAP} more lines\n`));
  }
}

// ── content preview ───────────────────────────────────────────────────────────

const PREVIEW_CAP = 22;

function renderPreview(lines: string[], lineColor = chalk.dim): void {
  const show = lines.slice(0, PREVIEW_CAP);
  for (let i = 0; i < show.length; i++) {
    const n = chalk.dim(String(i + 1).padStart(5));
    process.stdout.write("  " + n + chalk.dim(" │") + lineColor("  " + show[i]) + "\n");
  }
  if (lines.length > PREVIEW_CAP) {
    process.stdout.write(chalk.dim(`     … ${lines.length - PREVIEW_CAP} more lines\n`));
  }
}

// ── permission selector ──────────────────────────────────────────────────────

type Permission = "once" | "session" | "cancel";

async function askPermission(applyLabel: string): Promise<Permission> {
  process.stdout.write("\n");

  const { action } = await inquirer.prompt<{ action: Permission }>([
    {
      type: "select",
      name: "action",
      message: chalk.white("Allow JARVIS to make this change?"),
      choices: [
        {
          name: chalk.white(applyLabel),
          value: "once",
        },
        {
          name: chalk.green("Yes, for all changes this session") + chalk.dim("  — won't ask again"),
          value: "session",
        },
        {
          name: chalk.dim("No, cancel"),
          value: "cancel",
        },
      ],
    },
  ]);

  if (action === "session") {
    approveSession();
    process.stdout.write(
      chalk.dim("\n   Session authorized — JARVIS will apply future changes automatically.\n")
    );
  }

  return action;
}

// ── tools ────────────────────────────────────────────────────────────────────

export async function editFileTool(
  path: string,
  oldString: string,
  newString: string
): Promise<ToolResult> {
  const full = resolve(path);
  let content: string;

  try {
    content = await readFile(full, "utf-8");
  } catch {
    return { ok: false, output: `Cannot read "${path}". Check the path is correct.` };
  }

  const count = content.split(oldString).length - 1;

  if (count === 0) {
    return {
      ok: false,
      output:
        `old_string not found in "${path}". ` +
        `Use read_file first and copy the exact text — whitespace matters.`,
    };
  }
  if (count > 1) {
    return {
      ok: false,
      output:
        `old_string appears ${count} times in "${path}". ` +
        `Include more surrounding lines to make it unique.`,
    };
  }

  const startLine = content.slice(0, content.indexOf(oldString)).split("\n").length;
  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");

  stopThinking();
  panelHeader(chalk.bold("✎"), "EDIT", path, chalk.cyan);
  renderDiff(oldLines, newLines, startLine);

  if (!isSessionApproved()) {
    const perm = await askPermission("Yes, apply this edit");
    if (perm === "cancel") {
      process.stdout.write("\n");
      return { ok: false, output: "Edit cancelled by user." };
    }
  } else {
    process.stdout.write(chalk.dim("\n   ⚡ Session authorized — applying automatically.\n"));
  }

  const updated = content.replace(oldString, newString);
  try {
    await writeFile(full, updated, "utf-8");
  } catch (err) {
    return { ok: false, output: `Write failed: ${(err as Error).message}` };
  }

  process.stdout.write(chalk.green("\n   ✓  Applied.\n\n"));
  return { ok: true, output: `Edited "${path}" at line ${startLine}.` };
}

export async function createFileTool(
  path: string,
  content: string
): Promise<ToolResult> {
  const full = resolve(path);

  try {
    await access(full);
    return {
      ok: false,
      output: `"${path}" already exists. Use edit_file to modify it, or delete_file first.`,
    };
  } catch {
    // file doesn't exist — correct
  }

  const lines = content.split("\n");

  stopThinking();
  panelHeader(chalk.bold("+"), "CREATE", path, chalk.green);
  renderPreview(lines, chalk.dim);

  if (!isSessionApproved()) {
    const perm = await askPermission("Yes, create this file");
    if (perm === "cancel") {
      process.stdout.write("\n");
      return { ok: false, output: "Create cancelled by user." };
    }
  } else {
    process.stdout.write(chalk.dim("\n   ⚡ Session authorized — applying automatically.\n"));
  }

  try {
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf-8");
  } catch (err) {
    return { ok: false, output: `Write failed: ${(err as Error).message}` };
  }

  process.stdout.write(chalk.green(`\n   ✓  Created — ${lines.length} lines.\n\n`));
  return { ok: true, output: `Created "${path}" (${lines.length} lines).` };
}

export async function deleteFileTool(path: string): Promise<ToolResult> {
  const full = resolve(path);
  let content: string;

  try {
    content = await readFile(full, "utf-8");
  } catch {
    return { ok: false, output: `Cannot read "${path}". It may not exist.` };
  }

  stopThinking();
  panelHeader(chalk.bold.red("⚠"), "DELETE", path, chalk.red);
  renderPreview(content.split("\n"));
  process.stdout.write("\n" + chalk.red("   This cannot be undone.") + "\n");

  if (!isSessionApproved()) {
    const perm = await askPermission("Yes, delete this file");
    if (perm === "cancel") {
      process.stdout.write("\n");
      return { ok: false, output: "Deletion cancelled by user." };
    }
  } else {
    process.stdout.write(chalk.dim("\n   ⚡ Session authorized — applying automatically.\n"));
  }

  try {
    await unlink(full);
  } catch (err) {
    return { ok: false, output: `Delete failed: ${(err as Error).message}` };
  }

  process.stdout.write(chalk.green("\n   ✓  Deleted.\n\n"));
  return { ok: true, output: `Deleted "${path}".` };
}
