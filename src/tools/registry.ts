import {
  readFileTool,
  listDirectoryTool,
  searchFilesTool,
  grepFilesTool,
  type ToolResult,
} from "./fileTools.js";
import { executeCommandTool } from "./shellTools.js";

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
      "Search file CONTENTS across the project for a pattern (regex or plain text). Returns matching lines with file path and line number. Use this to find where a function, variable, or string is defined or used — much faster than reading files blindly.",
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
      "Run a shell command and return its combined stdout + stderr output. " +
      "Read-only commands (tsc, npm test, npm run <script>, jest, git status/log/diff/branch/show, npx, node <file>) " +
      "run automatically without asking. Any command that could modify files or the system " +
      "will pause and ask the user to type a confirmation phrase before executing. " +
      "Use this to check TypeScript errors, run tests, or inspect runtime state instead of guessing.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to run.",
        },
      },
      required: ["command"],
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
    default:
      return { ok: false, output: `Unknown tool: ${name}` };
  }
}
