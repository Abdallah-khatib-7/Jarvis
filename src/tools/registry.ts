import {
  readFileTool,
  listDirectoryTool,
  searchFilesTool,
  grepFilesTool,
  type ToolResult,
} from "./fileTools.js";
import { executeCommandTool } from "./shellTools.js";
import { editFileTool, createFileTool, deleteFileTool } from "./editTools.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description:
      "Read the contents of a text file. Returns content with 1-indexed line numbers so you can reference exact lines accurately.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative or absolute file path." },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders inside the given directory path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative or absolute directory path." },
      },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description:
      "Search the project for files whose NAME contains the query string. Use this when you don't know where a file lives.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to search for in filenames." },
      },
      required: ["query"],
    },
  },
  {
    name: "grep_files",
    description:
      "Search file CONTENTS across the project for a pattern (regex or plain text). Returns matching lines with file path and line number. Use this to find where a function, variable, or string is defined or used.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Regex or plain-text pattern to search for inside files.",
        },
        path: {
          type: "string",
          description:
            "Optional directory to search within. Defaults to the project root.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "execute_command",
    description:
      "Run a shell command and return its combined stdout + stderr. " +
      "Read-only commands (tsc, npm test, npm run <script>, jest, git status/log/diff/branch/show, npx, node <file>) " +
      "run automatically. Commands that may modify files or the system pause and ask the user to confirm first. " +
      "Use this to check TypeScript errors, run tests, or inspect runtime state.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run." },
      },
      required: ["command"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace an exact string in an existing file with new content. " +
      "Always read_file first to get the exact current text. " +
      "old_string must appear exactly once — include enough surrounding lines to make it unique. " +
      "The user will see a diff and must type a confirm phrase before the change is applied.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to edit." },
        old_string: {
          type: "string",
          description:
            "The exact text to find and replace. Must match the file contents character-for-character, including whitespace.",
        },
        new_string: {
          type: "string",
          description: "The replacement text.",
        },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "create_file",
    description:
      "Create a new file with the given content. Fails if the file already exists — use edit_file to modify existing files. " +
      "The user will see a content preview and must confirm before the file is written.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path of the file to create." },
        content: { type: "string", description: "Full content of the new file." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description:
      "Permanently delete a file. The user will see a file preview and must type a confirm phrase before deletion — this cannot be undone.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to delete." },
      },
      required: ["path"],
    },
  },
];

export async function runTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "read_file":
      return readFileTool(args.path as string);
    case "list_directory":
      return listDirectoryTool(args.path as string);
    case "search_files":
      return searchFilesTool(args.query as string);
    case "grep_files":
      return grepFilesTool(args.pattern as string, args.path as string | undefined);
    case "execute_command":
      return executeCommandTool(args.command as string);
    case "edit_file":
      return editFileTool(
        args.path as string,
        args.old_string as string,
        args.new_string as string
      );
    case "create_file":
      return createFileTool(args.path as string, args.content as string);
    case "delete_file":
      return deleteFileTool(args.path as string);
    default:
      return { ok: false, output: `Unknown tool: ${name}` };
  }
}
