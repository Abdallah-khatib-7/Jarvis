import { readFileTool, listDirectoryTool, type ToolResult } from "./fileTools.js";

/* the JSON-schema shape OpenAI's function calling expects, kept generic for other providers later */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/* what the AI sees when deciding which tool to call */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the contents of a text file at the given path.",
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
];

/* dispatches a tool call by name; this is the one place that maps AI intent to real code */
export async function runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "read_file":
      return readFileTool(args.path as string);
    case "list_directory":
      return listDirectoryTool(args.path as string);
    default:
      return { ok: false, output: `Unknown tool: ${name}` };
  }
}