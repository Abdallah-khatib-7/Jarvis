import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync, statSync } from "fs";
import os from "os";
import path from "path";
import chalk from "chalk";
import type { ImagePart } from "../ai/types.js";

// ── types ─────────────────────────────────────────────────────────────────────

export interface Attachment {
  filename: string;
  sizeKB: number;
  base64?: string;
  mimeType?: ImagePart["mimeType"];
  textContent?: string;
  pageCount?: number;
  kind: "image" | "document" | "text" | "unknown";
}

// ── image extension → MIME ────────────────────────────────────────────────────

const IMAGE_MIME: Record<string, ImagePart["mimeType"]> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const TEXT_EXTS = new Set([
  ".txt", ".md", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".java", ".go", ".rs", ".c", ".cpp", ".h", ".hpp",
  ".css", ".html", ".htm", ".json", ".yaml", ".yml", ".toml",
  ".xml", ".csv", ".sh", ".bat", ".ps1", ".sql", ".env",
  ".gitignore", ".dockerfile", ".ini", ".cfg",
]);

// ── magic-byte image detection (for extensionless files) ─────────────────────

function detectImageMime(buf: Buffer): ImagePart["mimeType"] | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return null;
}

function isPdf(buf: Buffer): boolean {
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

// PK zip magic — .docx, .xlsx, .pptx are all zip-based
function isZipBased(buf: Buffer): boolean {
  return buf[0] === 0x50 && buf[1] === 0x4b;
}

// ── native Windows file dialog ─────────────────────────────────────────────────

export async function openFileDialog(): Promise<string | null> {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$d = New-Object System.Windows.Forms.OpenFileDialog",
    '$d.Title = "Attach a file for JARVIS"',
    '$d.Filter = "All files (*.*)|*.*"',
    "$d.Multiselect = $false",
    "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  Write-Output $d.FileName",
    "} else {",
    '  Write-Output ""',
    "}",
  ].join("\n");

  const tmp = path.join(os.tmpdir(), `jarvis_attach_${Date.now()}.ps1`);
  try {
    writeFileSync(tmp, script, "utf8");
    const result = execSync(`powershell -File "${tmp}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return result || null;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

// ── screenshot capture ──────────────────────────────────────────────────────

export async function captureScreenshot(): Promise<string | null> {
  const outPath = path.join(os.tmpdir(), `jarvis_screen_${Date.now()}.png`);
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen",
    "$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height",
    "$g = [System.Drawing.Graphics]::FromImage($bmp)",
    "$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)",
    `$bmp.Save("${outPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)`,
    "$g.Dispose()",
    "$bmp.Dispose()",
  ].join("\n");

  const tmpScript = path.join(os.tmpdir(), `jarvis_screen_${Date.now()}.ps1`);
  try {
    writeFileSync(tmpScript, script, "utf8");
    execSync(`powershell -NoProfile -File "${tmpScript}"`, { stdio: ["pipe", "pipe", "pipe"] });
    return statSync(outPath).isFile() ? outPath : null;
  } catch {
    return null;
  } finally {
    try { unlinkSync(tmpScript); } catch {}
  }
}

// ── process selected file ─────────────────────────────────────────────────────

export async function processAttachment(filePath: string): Promise<Attachment> {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const data = readFileSync(filePath);
  const sizeKB = Math.round(statSync(filePath).size / 1024);

  // ── images by extension ──────────────────────────────────────────────────
  if (IMAGE_MIME[ext]) {
    return { filename, sizeKB, base64: data.toString("base64"), mimeType: IMAGE_MIME[ext], kind: "image" };
  }

  // ── extensionless or unknown: check magic bytes ───────────────────────────
  if (!ext || !".pdf.docx.txt.md".includes(ext)) {
    const mime = detectImageMime(data);
    if (mime) {
      return { filename, sizeKB, base64: data.toString("base64"), mimeType: mime, kind: "image" };
    }
    if (isPdf(data)) {
      return await parsePdf(data, filename, sizeKB);
    }
    if (isZipBased(data)) {
      return await parseDocx(data, filename, sizeKB);
    }
    // Fallback: try as UTF-8 text
    const text = tryText(data);
    if (text !== null) return { filename, sizeKB, textContent: text, kind: "text" };
    return { filename, sizeKB, textContent: `[Binary file — cannot be read as text]`, kind: "unknown" };
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (ext === ".pdf" || isPdf(data)) {
    return await parsePdf(data, filename, sizeKB);
  }

  // ── Word / Office ─────────────────────────────────────────────────────────
  if (ext === ".docx" || ext === ".pptx" || ext === ".xlsx") {
    return await parseDocx(data, filename, sizeKB);
  }

  // ── plain text / code ─────────────────────────────────────────────────────
  if (TEXT_EXTS.has(ext)) {
    return { filename, sizeKB, textContent: data.toString("utf8"), kind: "text" };
  }

  // ── last resort: try UTF-8 ────────────────────────────────────────────────
  const text = tryText(data);
  if (text !== null) return { filename, sizeKB, textContent: text, kind: "text" };

  return { filename, sizeKB, textContent: `[Cannot read binary file: ${filename}]`, kind: "unknown" };
}

async function parsePdf(data: Buffer, filename: string, sizeKB: number): Promise<Attachment> {
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    const result = await pdfParse(data);
    return {
      filename, sizeKB, kind: "document",
      textContent: result.text.trim(),
      pageCount: result.numpages,
    };
  } catch {
    return { filename, sizeKB, kind: "document", textContent: "[PDF could not be parsed — try copying the text manually]" };
  }
}

async function parseDocx(data: Buffer, filename: string, sizeKB: number): Promise<Attachment> {
  try {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer: data });
    return { filename, sizeKB, kind: "document", textContent: result.value.trim() };
  } catch {
    return { filename, sizeKB, kind: "document", textContent: "[Document could not be parsed]" };
  }
}

function tryText(buf: Buffer): string | null {
  if (buf.includes(0x00)) return null; // null bytes → binary
  try {
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

// ── show attachment panel in terminal ─────────────────────────────────────────

export function showAttachmentPanel(att: Attachment): void {
  const w = Math.min((process.stdout.columns || 80) - 2, 88);
  const c = chalk.magenta;

  const icons: Record<Attachment["kind"], string> = {
    image: "◈ IMAGE",
    document: "◈ DOCUMENT",
    text: "◈ FILE",
    unknown: "◈ FILE",
  };

  const tag = ` ${icons[att.kind]} `;
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));

  process.stdout.write("\n");
  process.stdout.write(c(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(c("│") + "  " + chalk.bold.white(att.filename) + chalk.dim(`  ·  ${att.sizeKB} KB`) + "\n");

  if (att.kind === "document" && att.pageCount) {
    process.stdout.write(c("│") + "  " + chalk.dim(`${att.pageCount} pages extracted`) + "\n");
  }
  if (att.kind === "text" && att.textContent) {
    const lines = att.textContent.split("\n").length;
    process.stdout.write(c("│") + "  " + chalk.dim(`${lines} lines`) + "\n");
  }
  if (att.kind === "image") {
    process.stdout.write(c("│") + "  " + chalk.dim(`sending to Vision API`) + "\n");
  }

  process.stdout.write(c(`╰${"─".repeat(w - 1)}`) + "\n\n");
}
