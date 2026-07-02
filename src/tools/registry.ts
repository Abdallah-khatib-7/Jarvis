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
import { webSearchTool, webNewsTool } from "./webSearch.js";
import { setReminderTool, listRemindersTool, cancelReminderTool } from "./reminders.js";
import {
  telegramConnectTool,
  telegramSendTool,
  telegramSendFileTool,
  telegramDisconnectTool,
} from "../connectors/telegram.js";
import {
  gmailConnectTool,
  gmailSendTool,
  gmailInboxTool,
  gmailSearchTool,
  gmailReadTool,
  gmailDisconnectTool,
} from "../connectors/gmail.js";
import {
  githubSearchTool,
  githubListReposTool,
  githubGetRepoTool,
  githubGetFileTool,
  githubGetPrTool,
  githubGetIssueTool,
  githubCreateIssueTool,
  githubCommentTool,
  githubCreatePrTool,
  githubListRunsTool,
  githubTriggerWorkflowTool,
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
  // ── File ops ──────────────────────────────────────────────────────────────
  {
    name: "read_file",
    description: "Read a file with line numbers.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "File path." } },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and folders in a directory.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Directory path." } },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description: "Find files by name.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Filename search term." } },
      required: ["query"],
    },
  },
  {
    name: "grep_files",
    description: "Search file contents by regex or text.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex or text to find." },
        path: { type: "string", description: "Directory to search (optional)." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "execute_command",
    description: "Run a shell command. Read-only commands (tsc, npm, git status/log/diff) run automatically; destructive commands need user confirmation.",
    parameters: {
      type: "object",
      properties: { command: { type: "string", description: "Shell command." } },
      required: ["command"],
    },
  },
  {
    name: "edit_file",
    description: "Replace exact text in a file. Read file first. old_string must match exactly and be unique.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path." },
        old_string: { type: "string", description: "Exact text to replace." },
        new_string: { type: "string", description: "Replacement text." },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "create_file",
    description: "Create a new file. Fails if file exists — use edit_file to modify.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path." },
        content: { type: "string", description: "File content." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file permanently. User must confirm.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "File path." } },
      required: ["path"],
    },
  },

  // ── Memory ────────────────────────────────────────────────────────────────
  {
    name: "remember",
    description: "Store a fact about the user in long-term memory. Use snake_case keys.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Snake_case key (e.g. preferred_language)." },
        value: { type: "string", description: "Value to store." },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "forget",
    description: "Remove a fact from memory by key.",
    parameters: {
      type: "object",
      properties: { key: { type: "string", description: "Key to remove." } },
      required: ["key"],
    },
  },
  {
    name: "recall",
    description: "Get all stored memory facts.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  // ── GitHub ────────────────────────────────────────────────────────────────
  {
    name: "github_search",
    description: "Search GitHub issues/PRs. Use GitHub search syntax (is:pr is:open author:@me).",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "GitHub search query." } },
      required: ["query"],
    },
  },
  {
    name: "github_list_repos",
    description: "List the user's GitHub repositories.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "github_get_repo",
    description: "Get repo info: description, language, stars, topics.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_get_file",
    description: "Read a file from a GitHub repo. Use for remote files, not local ones.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        path: { type: "string", description: "File path in repo." },
        ref: { type: "string", description: "Branch/tag/SHA (optional)." },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "github_get_pr",
    description: "Get PR details: title, description, changed files, reviews.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        number: { type: "number", description: "PR number." },
      },
      required: ["owner", "repo", "number"],
    },
  },
  {
    name: "github_get_issue",
    description: "Get issue details: title, body, labels, comments.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        number: { type: "number", description: "Issue number." },
      },
      required: ["owner", "repo", "number"],
    },
  },
  {
    name: "github_create_issue",
    description: "Create a GitHub issue. Shows preview, user confirms.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        title: { type: "string", description: "Issue title." },
        body: { type: "string", description: "Issue body (markdown, optional)." },
      },
      required: ["owner", "repo", "title"],
    },
  },
  {
    name: "github_comment",
    description: "Post a comment on an issue or PR. Shows preview, user confirms.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        number: { type: "number", description: "Issue or PR number." },
        body: { type: "string", description: "Comment text (markdown)." },
      },
      required: ["owner", "repo", "number", "body"],
    },
  },
  {
    name: "github_create_pr",
    description: "Open a PR (head→base). Shows preview, user confirms.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        title: { type: "string", description: "PR title." },
        head: { type: "string", description: "Source branch." },
        base: { type: "string", description: "Target branch (e.g. main)." },
        body: { type: "string", description: "PR description (optional)." },
        draft: { type: "string", description: "'true' for draft PR (optional)." },
      },
      required: ["owner", "repo", "title", "head", "base"],
    },
  },
  {
    name: "github_list_runs",
    description: "List recent GitHub Actions workflow runs.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        workflow: { type: "string", description: "Workflow filename to filter (optional)." },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "github_trigger_workflow",
    description: "Trigger a workflow_dispatch workflow. Shows preview, user confirms.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repo owner." },
        repo: { type: "string", description: "Repo name." },
        workflow: { type: "string", description: "Workflow filename (e.g. deploy.yml)." },
        ref: { type: "string", description: "Branch or tag." },
        inputs: { type: "string", description: "JSON inputs string (optional)." },
      },
      required: ["owner", "repo", "workflow", "ref"],
    },
  },
  {
    name: "github_disconnect",
    description: "Remove stored GitHub token.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  // ── Telegram ──────────────────────────────────────────────────────────────
  {
    name: "telegram_connect",
    description: "Set up Telegram connection (bot token + chat ID).",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "telegram_send",
    description: "Send a text message to the user's Telegram. HTML: <b>bold</b> <code>code</code>.",
    parameters: {
      type: "object",
      properties: { message: { type: "string", description: "Message text (HTML ok)." } },
      required: ["message"],
    },
  },
  {
    name: "telegram_send_file",
    description: "Send a local file to the user's Telegram.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Local file path." },
        caption: { type: "string", description: "Caption (optional)." },
      },
      required: ["path"],
    },
  },
  {
    name: "telegram_disconnect",
    description: "Remove stored Telegram credentials.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  // ── Gmail ─────────────────────────────────────────────────────────────────
  {
    name: "gmail_connect",
    description: "Set up Gmail with App Password.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "gmail_send",
    description: "Send an email. Shows preview, user confirms.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email." },
        subject: { type: "string", description: "Subject line." },
        body: { type: "string", description: "Plain text body." },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "gmail_inbox",
    description: "List recent inbox emails with UIDs.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number", description: "Max emails (default 15)." } },
      required: [],
    },
  },
  {
    name: "gmail_search",
    description: "Search emails by from/subject/text/unread.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Sender filter." },
        subject: { type: "string", description: "Subject keyword." },
        text: { type: "string", description: "Body text search." },
        unread: { type: "string", description: "'true' for unread only." },
      },
      required: [],
    },
  },
  {
    name: "gmail_read",
    description: "Read a full email by UID.",
    parameters: {
      type: "object",
      properties: { uid: { type: "number", description: "Email UID from inbox/search." } },
      required: ["uid"],
    },
  },
  {
    name: "gmail_disconnect",
    description: "Remove stored Gmail credentials.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  // ── Web search ────────────────────────────────────────────────────────────
  {
    name: "web_search",
    description: "Search Google. Use for current info: prices, versions, docs, news.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        num: { type: "number", description: "Results count (default 8)." },
      },
      required: ["query"],
    },
  },
  {
    name: "web_news",
    description: "Search Google News for recent articles.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "News search query." },
        num: { type: "number", description: "Articles count (default 8)." },
      },
      required: ["query"],
    },
  },

  // ── Reminders ─────────────────────────────────────────────────────────────
  {
    name: "remind_me",
    description: "Schedule a reminder. Parse natural language: '30 min'→30, '2 hours'→120.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Reminder text." },
        delay_minutes: { type: "number", description: "Minutes from now (1–1440)." },
      },
      required: ["message", "delay_minutes"],
    },
  },
  {
    name: "list_reminders",
    description: "List active reminders with IDs and time remaining.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a reminder by ID.",
    parameters: {
      type: "object",
      properties: { id: { type: "number", description: "Reminder ID." } },
      required: ["id"],
    },
  },
];

export async function runTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  switch (name) {
    case "read_file":          return readFileTool(args.path as string);
    case "list_directory":     return listDirectoryTool(args.path as string);
    case "search_files":       return searchFilesTool(args.query as string);
    case "grep_files":         return grepFilesTool(args.pattern as string, args.path as string | undefined);
    case "execute_command":    return executeCommandTool(args.command as string);
    case "edit_file":          return editFileTool(args.path as string, args.old_string as string, args.new_string as string);
    case "create_file":        return createFileTool(args.path as string, args.content as string);
    case "delete_file":        return deleteFileTool(args.path as string);
    case "remember":           return rememberTool(args.key as string, args.value as string);
    case "forget":             return forgetTool(args.key as string);
    case "recall":             return recallTool();
    case "github_search":      return githubSearchTool(args.query as string);
    case "github_list_repos":  return githubListReposTool();
    case "github_get_repo":    return githubGetRepoTool(args.owner as string, args.repo as string);
    case "github_get_file":    return githubGetFileTool(args.owner as string, args.repo as string, args.path as string, args.ref as string | undefined);
    case "github_get_pr":      return githubGetPrTool(args.owner as string, args.repo as string, Number(args.number));
    case "github_get_issue":   return githubGetIssueTool(args.owner as string, args.repo as string, Number(args.number));
    case "github_create_issue": return githubCreateIssueTool(args.owner as string, args.repo as string, args.title as string, args.body as string | undefined);
    case "github_comment":     return githubCommentTool(args.owner as string, args.repo as string, Number(args.number), args.body as string);
    case "github_create_pr":   return githubCreatePrTool(args.owner as string, args.repo as string, args.title as string, args.head as string, args.base as string, args.body as string | undefined, args.draft === "true" || args.draft === true);
    case "github_list_runs":   return githubListRunsTool(args.owner as string, args.repo as string, args.workflow as string | undefined);
    case "github_trigger_workflow": return githubTriggerWorkflowTool(args.owner as string, args.repo as string, args.workflow as string, args.ref as string, args.inputs ? (JSON.parse(args.inputs as string) as Record<string, string>) : undefined);
    case "github_disconnect":  return githubDisconnectTool();
    case "telegram_connect":   return telegramConnectTool();
    case "telegram_send":      return telegramSendTool(args.message as string);
    case "telegram_send_file": return telegramSendFileTool(args.path as string, args.caption as string | undefined);
    case "telegram_disconnect": return telegramDisconnectTool();
    case "gmail_connect":      return gmailConnectTool();
    case "gmail_send":         return gmailSendTool(args.to as string, args.subject as string, args.body as string);
    case "gmail_inbox":        return gmailInboxTool(args.limit ? Number(args.limit) : undefined);
    case "gmail_search":       return gmailSearchTool(args.from as string | undefined, args.subject as string | undefined, args.text as string | undefined, args.unread === "true" || args.unread === true);
    case "gmail_read":         return gmailReadTool(Number(args.uid));
    case "gmail_disconnect":   return gmailDisconnectTool();
    case "web_search":         return webSearchTool(args.query as string, args.num ? Number(args.num) : undefined);
    case "web_news":           return webNewsTool(args.query as string, args.num ? Number(args.num) : undefined);
    case "remind_me":          return setReminderTool(args.message as string, Number(args.delay_minutes));
    case "list_reminders":     return listRemindersTool();
    case "cancel_reminder":    return cancelReminderTool(Number(args.id));
    default:                   return { ok: false, output: `Unknown tool: ${name}` };
  }
}
