import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

/* every tool result comes back in this shape so the AI loop can handle success/failure uniformly */
export interface ToolResult {
  ok: boolean;
  output: string;
}

export async function readFileTool(path: string): Promise<ToolResult> {
  try {
    const full = resolve(path);
    const content = await readFile(full, "utf-8");
    return { ok: true, output: content };
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