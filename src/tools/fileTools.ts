import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, extname } from "node:path";

export interface ToolResult {
  ok: boolean;
  output: string;
}

export async function readFileTool(path: string): Promise<ToolResult> {
  try {
    const full = resolve(path);
    const raw = await readFile(full, "utf-8");
    const content = raw.replace(/\r\n/g, "\n");
    const numbered = content
      .split("\n")
      .map((line, i) => `${i + 1}: ${line}`)
      .join("\n");
    return { ok: true, output: numbered };
  } catch (err) {
    return { ok: false, output: `Could not read "${path}": ${(err as Error).message}` };
  }
}

export async function listDirectoryTool(path: string): Promise<ToolResult> {
  try {
    const full = resolve(path);
    const entries = await readdir(full, { withFileTypes: true });
    const listed = entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .join("\n");
    return { ok: true, output: listed || "(empty directory)" };
  } catch (err) {
    return { ok: false, output: `Could not list "${path}": ${(err as Error).message}` };
  }
}

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);

export async function searchFilesTool(query: string): Promise<ToolResult> {
  const root = resolve(".");
  const matches: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
        matches.push(full.replace(root, ".").replaceAll("\\", "/"));
      }
    }
  }

  try {
    await walk(root);
    if (matches.length === 0) {
      return { ok: false, output: `No files matching "${query}" found.` };
    }
    return { ok: true, output: matches.join("\n") };
  } catch (err) {
    return { ok: false, output: `Search failed: ${(err as Error).message}` };
  }
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".eot",
  ".pdf", ".zip", ".gz", ".tar", ".7z",
  ".db", ".sqlite",
  ".map", ".lock",
]);

const MAX_GREP_FILE_BYTES = 500 * 1024;
const MAX_GREP_RESULTS = 100;

export async function grepFilesTool(pattern: string, searchPath?: string): Promise<ToolResult> {
  const root = resolve(".");
  const searchRoot = resolve(searchPath ?? ".");

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i");
  } catch {
    return { ok: false, output: `Invalid regex pattern: "${pattern}"` };
  }

  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }

      if (BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

      try {
        const info = await stat(full);
        if (info.size > MAX_GREP_FILE_BYTES) continue;

        const content = await readFile(full, "utf-8");
        const lines = content.split("\n");
        const rel = full.replace(root, ".").replaceAll("\\", "/");

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
            if (results.length >= MAX_GREP_RESULTS) return;
          }
        }
      } catch {
        // skip unreadable or binary files silently
      }
    }
  }

  try {
    await walk(searchRoot);
    if (results.length === 0) {
      return { ok: false, output: `No content matches for "${pattern}".` };
    }
    const note =
      results.length >= MAX_GREP_RESULTS
        ? `\n\n... (capped at ${MAX_GREP_RESULTS} results — narrow your pattern if needed)`
        : "";
    return { ok: true, output: results.join("\n") + note };
  } catch (err) {
    return { ok: false, output: `Grep failed: ${(err as Error).message}` };
  }
}
