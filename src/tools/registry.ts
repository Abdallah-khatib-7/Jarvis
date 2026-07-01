import {
  readFileTool,
  listDirectoryTool,
  searchFilesTool,
  grepFilesTool,
  type ToolResult,
} from "./fileTools.js";
import { executeCommandTool } from "./shellTools.js";
import { editFileTool, createFileTool, deleteFileTool } from "./editTools.js";
import { rememberTool, forgetTool, recallTool } from "./memoryTools.js";
import {
  githubSearchTool,
  githubListReposTool,
  githubGetRepoTool,
  githubGetFileTool,
  githubGetPrTool,
  githubGetIssueTool,
  githubCreateIssueTool,
  githubCommentTool,
  githubDisconnectTool,
} from "../connectors/github.js";

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
          description: "Optional directory to search within. Defaults to the project root.",
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
      "The user will see a diff before the change is applied.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to edit." },
        old_string: {
          type: "string",
          description:
            "The exact text to find and replace. Must match file contents character-for-character including whitespace.",
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
      "The user will see a content preview before the file is written.",
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
      "Permanently delete a file. The user will see a file preview and must confirm before deletion.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to delete." },
      },
      required: ["path"],
    },
  },
  {
    name: "remember",
    description:
      "Store a fact about the user in long-term memory. " +
      "Call this proactively whenever you learn something worth keeping across sessions: " +
      "preferences (coding style, tools, language), project context (what they're building, tech stack), " +
      "or personal details (profession, goals). Use lowercase_snake_case keys. " +
      "Calling remember overwrites any existing value for that key.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            "Snake_case identifier for this fact. E.g. preferred_language, current_project, works_as, uses_tabs.",
        },
        value: {
          type: "string",
          description: "The value to store. Keep it concise — one short phrase.",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "forget",
    description:
      "Remove a stored fact from the user's memory by key. " +
      "Use when the user says something you remembered was wrong, or explicitly asks you to forget something.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key of the fact to remove.",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "recall",
    description:
      "Retrieve all facts currently stored in the user's memory. " +
      "Use this mid-conversation if you need to check what you know — " +
      "especially after calling remember, since the system prompt reflects the state from when this session started.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── GitHub connector (requires GITHUB_TOKEN in .env) ─────────────────────
  {
    name: "github_search",
    description:
      "Search GitHub issues and pull requests using GitHub search syntax. " +
      "Examples: 'is:pr is:open author:@me' · 'is:issue is:open assignee:@me' · 'is:issue repo:owner/repo bug'. " +
      "Use this first when you don't know the exact repo or number.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "GitHub search query string." },
      },
      required: ["query"],
    },
  },
  {
    name: "github_list_repos",
    description: "List the authenticated user's GitHub repositories, sorted by last updated.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "github_get_repo",
    description:
      "Get overview info for a GitHub repository: description, language, stars, forks, topics, default branch. " +
      "Use this when the user asks about a project in general.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (username or org)." },
        repo: { type: "string", description: "Repository name." },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_get_file",
    description:
      "Read the contents of any file in a GitHub repository (README, source files, configs, etc.). " +
      "Returns the decoded text content. Also works as a directory listing if path points to a folder. " +
      "Use this whenever the user asks about a file in a remote repo — README.md, package.json, etc.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner." },
        repo: { type: "string", description: "Repository name." },
        path: { type: "string", description: "File path within the repo, e.g. README.md or src/index.ts." },
        ref: { type: "string", description: "Branch, tag, or commit SHA. Defaults to the repo's default branch." },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "github_get_pr",
    description:
      "Get full details for a GitHub pull request: title, description, changed files, and review status.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (username or org)." },
        repo: { type: "string", description: "Repository name." },
        number: { type: "number", description: "Pull request number." },
      },
      required: ["owner", "repo", "number"],
    },
  },
  {
    name: "github_get_issue",
    description:
      "Get full details for a GitHub issue: title, description, labels, assignees, and comments.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner (username or org)." },
        repo: { type: "string", description: "Repository name." },
        number: { type: "number", description: "Issue number." },
      },
      required: ["owner", "repo", "number"],
    },
  },
  {
    name: "github_create_issue",
    description:
      "Create a new GitHub issue. Shows a preview panel and asks the user to confirm before posting.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner." },
        repo: { type: "string", description: "Repository name." },
        title: { type: "string", description: "Issue title." },
        body: { type: "string", description: "Issue body (markdown). Optional." },
      },
      required: ["owner", "repo", "title"],
    },
  },
  {
    name: "github_comment",
    description:
      "Post a comment on a GitHub issue or pull request. Shows a preview and asks the user to confirm before posting.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner." },
        repo: { type: "string", description: "Repository name." },
        number: { type: "number", description: "Issue or PR number." },
        body: { type: "string", description: "Comment text (markdown)." },
      },
      required: ["owner", "repo", "number", "body"],
    },
  },
  {
    name: "github_disconnect",
    description:
      "Remove the stored GitHub token for the current user. " +
      "Call this when the user wants to disconnect GitHub, rotate their token, or fix authentication errors.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
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
    case "remember":
      return rememberTool(args.key as string, args.value as string);
    case "forget":
      return forgetTool(args.key as string);
    case "recall":
      return recallTool();
    case "github_search":
      return githubSearchTool(args.query as string);
    case "github_list_repos":
      return githubListReposTool();
    case "github_get_repo":
      return githubGetRepoTool(args.owner as string, args.repo as string);
    case "github_get_file":
      return githubGetFileTool(
        args.owner as string,
        args.repo as string,
        args.path as string,
        args.ref as string | undefined
      );
    case "github_get_pr":
      return githubGetPrTool(args.owner as string, args.repo as string, Number(args.number));
    case "github_get_issue":
      return githubGetIssueTool(args.owner as string, args.repo as string, Number(args.number));
    case "github_create_issue":
      return githubCreateIssueTool(
        args.owner as string,
        args.repo as string,
        args.title as string,
        args.body as string | undefined
      );
    case "github_comment":
      return githubCommentTool(
        args.owner as string,
        args.repo as string,
        Number(args.number),
        args.body as string
      );
    case "github_disconnect":
      return githubDisconnectTool();
    default:
      return { ok: false, output: `Unknown tool: ${name}` };
  }
}
