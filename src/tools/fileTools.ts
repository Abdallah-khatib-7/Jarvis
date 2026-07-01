import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/* every tool result comes back in this shape so the AI loop can handle success/failure uniformly */
export interface ToolResult {
  ok: boolean;
  output: string;
}

export async function readFileTool(path: string): Promise<ToolResult> {
  try {
    const full = resolve(path);
    const content = await readFile(full, "utf-8");
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


const IGNORE_DIRS = new Set(["node_modules", ".git", "dist"]);

/* walks the project tree looking for filenames that contain the query */
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