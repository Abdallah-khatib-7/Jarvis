import chalk from "chalk";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 4, 90);
}

// ── word wrap (raw text, no ANSI) ─────────────────────────────────────────────

function wrapRaw(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= width) { cur += " " + w; }
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── inline markdown → ANSI ────────────────────────────────────────────────────

function renderInline(raw: string): string {
  let out = "";
  let buf = "";
  let i = 0;

  const flush = () => { if (buf) { out += chalk.blue(buf); buf = ""; } };

  while (i < raw.length) {
    // Bold **...**
    if (raw[i] === "*" && raw[i + 1] === "*") {
      const end = raw.indexOf("**", i + 2);
      if (end !== -1) { flush(); out += chalk.bold.white(raw.slice(i + 2, end)); i = end + 2; continue; }
    }
    // Inline code `...`
    if (raw[i] === "`") {
      const end = raw.indexOf("`", i + 1);
      if (end !== -1) { flush(); out += chalk.green(raw.slice(i + 1, end)); i = end + 1; continue; }
    }
    // Link [text](url)
    if (raw[i] === "[") {
      const te = raw.indexOf("]", i);
      if (te !== -1 && raw[te + 1] === "(") {
        const ue = raw.indexOf(")", te + 2);
        if (ue !== -1) {
          flush();
          out += chalk.blue.underline(raw.slice(i + 1, te)) + chalk.dim(" → " + raw.slice(te + 2, ue));
          i = ue + 1; continue;
        }
      }
    }
    buf += raw[i++];
  }
  flush();
  return out;
}

// ── ANSI-safe typewriter (skips escape sequences without delay) ───────────────

async function typeAnsi(rendered: string, speedMs: number): Promise<void> {
  if (speedMs === 0) { process.stdout.write(rendered); return; }
  let i = 0;
  while (i < rendered.length) {
    if (rendered.charCodeAt(i) === 0x1b) {
      let j = i + 1;
      while (j < rendered.length && rendered[j] !== "m") j++;
      process.stdout.write(rendered.slice(i, j + 1));
      i = j + 1;
    } else {
      process.stdout.write(rendered[i++]);
      await sleep(speedMs);
    }
  }
}

// ── block parser ──────────────────────────────────────────────────────────────

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "bullet"; text: string; depth: number }
  | { kind: "numbered"; n: number; text: string }
  | { kind: "code"; lang: string; lines: string[] }
  | { kind: "rule" }
  | { kind: "blank" }
  | { kind: "text"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    const fenceM = line.match(/^```(\w*)$/);
    if (fenceM) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) codeLines.push(lines[i++]);
      out.push({ kind: "code", lang: fenceM[1] || "", lines: codeLines });
      i++;
      continue;
    }

    if (line.startsWith("# "))   { out.push({ kind: "h1", text: line.slice(2) });  i++; continue; }
    if (line.startsWith("## "))  { out.push({ kind: "h2", text: line.slice(3) });  i++; continue; }
    if (line.startsWith("### ")) { out.push({ kind: "h3", text: line.slice(4) });  i++; continue; }

    if (/^[-*_]{3,}$/.test(line.trim())) { out.push({ kind: "rule" }); i++; continue; }
    if (line.trim() === "")              { out.push({ kind: "blank" }); i++; continue; }

    const bulletM = line.match(/^(\s*)[-*+] (.+)$/);
    if (bulletM) { out.push({ kind: "bullet", text: bulletM[2], depth: Math.floor(bulletM[1].length / 2) }); i++; continue; }

    const numM = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numM) { out.push({ kind: "numbered", n: parseInt(numM[1]), text: numM[2] }); i++; continue; }

    out.push({ kind: "text", text: line });
    i++;
  }
  return out;
}

// ── block renderer ────────────────────────────────────────────────────────────

async function renderBlock(block: Block, w: number, speedMs: number): Promise<void> {
  switch (block.kind) {

    case "h1":
      process.stdout.write("\n");
      process.stdout.write(chalk.bold.cyan(block.text.toUpperCase()) + "\n");
      process.stdout.write(chalk.cyan("─".repeat(Math.min(block.text.length + 2, w))) + "\n");
      break;

    case "h2":
      process.stdout.write("\n" + chalk.bold.white(block.text) + "\n");
      break;

    case "h3":
      process.stdout.write(chalk.bold.dim(block.text) + "\n");
      break;

    case "rule":
      process.stdout.write(chalk.dim("─".repeat(w)) + "\n");
      break;

    case "blank":
      process.stdout.write("\n");
      break;

    case "bullet": {
      const pad = "  ".repeat(block.depth + 1);
      const contPad = pad + "  ";
      const wrapped = wrapRaw(block.text, w - pad.length - 3);
      for (let idx = 0; idx < wrapped.length; idx++) {
        const prefix = idx === 0 ? pad + chalk.cyan("◆") + " " : contPad + "  ";
        await typeAnsi(prefix + renderInline(wrapped[idx]), speedMs);
        process.stdout.write("\n");
      }
      break;
    }

    case "numbered": {
      const label = chalk.cyan(`${block.n}.`);
      const wrapped = wrapRaw(block.text, w - 6);
      for (let idx = 0; idx < wrapped.length; idx++) {
        const prefix = idx === 0 ? "  " + label + " " : "      ";
        await typeAnsi(prefix + renderInline(wrapped[idx]), speedMs);
        process.stdout.write("\n");
      }
      break;
    }

    case "code": {
      const langLabel = block.lang ? chalk.dim(` ${block.lang} `) : "";
      const barW = w - 4 - (block.lang ? block.lang.length + 2 : 0);
      process.stdout.write("\n" + chalk.dim(`  ╭─${langLabel}${"─".repeat(Math.max(0, barW))}`) + "\n");
      for (const ln of block.lines) {
        process.stdout.write(chalk.dim("  │") + "  " + chalk.green(ln) + "\n");
      }
      process.stdout.write(chalk.dim(`  ╰${"─".repeat(w - 2)}`) + "\n\n");
      break;
    }

    case "text": {
      for (const rawLine of wrapRaw(block.text, w)) {
        await typeAnsi(renderInline(rawLine), speedMs);
        process.stdout.write("\n");
      }
      break;
    }
  }
}

// ── public API ────────────────────────────────────────────────────────────────

export async function revealSpeech(text: string, speedMs = 4): Promise<void> {
  const w = termWidth();
  process.stdout.write("\n");
  for (const block of parseBlocks(text.trim())) {
    await renderBlock(block, w, speedMs);
  }
  process.stdout.write("\n");
}
