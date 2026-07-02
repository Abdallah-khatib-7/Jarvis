import chalk, { type ChalkInstance } from "chalk";
import gradient from "gradient-string";
import ansiEscapes from "ansi-escapes";

/* Shared visual language for JARVIS's terminal UI — boxed HUD panels, the
   house blue/cyan gradient, and centering helpers — so boot, login,
   onboarding, and the chat UI all read as one system instead of drifting. */

export const BRAND_GRADIENT = ["#00c6ff", "#0072ff"] as const;
export const brand = gradient(BRAND_GRADIENT as unknown as string[]);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function termCols(): number {
  return process.stdout.columns || 80;
}

export function termWidth(margin = 2): number {
  return Math.min(termCols() - margin, 92);
}

export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLength(s: string): number {
  return stripAnsi(s).length;
}

/* centers a single line (ANSI-safe: pads by visible width, not byte length) */
export function center(line: string, width = termCols()): string {
  const pad = Math.max(0, Math.floor((width - visibleLength(line)) / 2));
  return " ".repeat(pad) + line;
}

/* centers a multi-line block against its widest raw line so shapes (ASCII art) stay intact */
export function centerBlock(lines: string[], width = termCols()): string[] {
  const widest = Math.max(...lines.map((l) => visibleLength(l)));
  const pad = " ".repeat(Math.max(0, Math.floor((width - widest) / 2)));
  return lines.map((l) => pad + l);
}

export function hline(n: number): string {
  return "─".repeat(Math.max(0, n));
}

// ── boxed HUD panel ──────────────────────────────────────────────────────────

export interface PanelOptions {
  icon?: string;
  title: string;
  color?: ChalkInstance;
  width?: number;
}

export function panelOpen({ icon = "◈", title, color = chalk.cyan, width = termWidth() }: PanelOptions): number {
  const tag = ` ${icon} ${title} `;
  const fill = hline(Math.max(0, width - 2 - visibleLength(tag)));
  process.stdout.write(color(`╭─${tag}${fill}`) + "\n");
  return width;
}

export function panelLine(text: string, color: ChalkInstance = chalk.cyan, width = termWidth()): void {
  if (text === "") {
    process.stdout.write(color("│") + "\n");
    return;
  }
  process.stdout.write(color("│") + "  " + text + "\n");
}

export function panelClose(color: ChalkInstance = chalk.cyan, width = termWidth()): void {
  process.stdout.write(color(`╰${hline(width - 1)}`) + "\n\n");
}

/* one-shot panel: header + body lines + footer, in one call */
export function panel(opts: PanelOptions, body: string[]): void {
  const width = panelOpen(opts);
  for (const line of body) panelLine(line, opts.color ?? chalk.cyan, width);
  panelClose(opts.color ?? chalk.cyan, width);
}

// ── inline status glyphs (consistent icons for the whole app) ────────────────

export const ok = (text: string): string => chalk.green("✓ ") + chalk.white(text);
export const warn = (text: string): string => chalk.yellow("⚠ ") + chalk.yellow(text);
export const fail = (text: string): string => chalk.red("✗ ") + chalk.red(text);

// ── step badge for multi-question flows ───────────────────────────────────────

export function stepBadge(step: number, total: number): string {
  return chalk.dim(`◈ step ${step} of ${total}`);
}

// ── cursor helpers ─────────────────────────────────────────────────────────────

export function hideCursor(): void {
  process.stdout.write(ansiEscapes.cursorHide);
}

export function showCursor(): void {
  process.stdout.write(ansiEscapes.cursorShow);
}
