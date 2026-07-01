import chalk from "chalk";
import { openAIProvider } from "../ai/openai.js";
import { claudeProvider } from "../ai/claude.js";
import type { AIProvider, ChatMessage } from "../ai/types.js";
import { withThinking } from "../ui/thinking.js";
import { revealSpeech } from "../ui/reveal.js";
import { getFact, getAllFacts } from "../database/memory.js";
import { voiceFor } from "../ai/personality.js";
import { askRaw } from "../auth/prompts.js";
import { setActiveUser } from "../tools/memoryTools.js";
import type { Session } from "../auth/login.js";

const PROMPT_ARROW = chalk.cyan("⟩");

function resolveProvider(session: Session): AIProvider {
  const pref = getFact(session.id, "ai_provider");
  if (pref === "claude" && process.env.ANTHROPIC_API_KEY) return claudeProvider;
  if (pref === "openai" && process.env.OPENAI_API_KEY) return openAIProvider;
  /* Auto-select: Claude first (stronger), fall back to OpenAI */
  if (process.env.ANTHROPIC_API_KEY) return claudeProvider;
  if (process.env.OPENAI_API_KEY) return openAIProvider;
  throw new Error(
    "No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file."
  );
}

function providerLabel(p: AIProvider): string {
  return p.name === "claude" ? "Claude (sonnet-4-6)" : "OpenAI (gpt-4o-mini)";
}

function factsBlock(session: Session): string {
  const facts = getAllFacts(session.id);
  if (facts.length === 0) return "  (nothing stored yet)";
  return facts.map((f) => `  ${f.key}: ${f.value}`).join("\n");
}

function buildSystemPrompt(session: Session): string {
  const personality = getFact(session.id, "personality");
  return [
    `You are JARVIS, a personal AI assistant running in the user's terminal.`,
    `Voice: ${voiceFor(personality)}.`,
    ``,
    `Tools — use them aggressively, never guess when you can act:`,
    `  read_file         — read any file with 1-indexed line numbers`,
    `  list_directory    — list folder contents`,
    `  search_files      — find files by name`,
    `  grep_files        — search file contents by regex`,
    `  execute_command   — run shell commands (tsc, npm test, git status, etc.)`,
    `  edit_file         — surgical find-and-replace in an existing file`,
    `  create_file       — create a new file with content`,
    `  delete_file       — permanently delete a file`,
    `  remember          — store a fact about the user in long-term memory`,
    `  forget            — remove a stored fact by key`,
    `  recall            — get the full current fact list mid-conversation`,
    ``,
    `File ops:`,
    `  - When asked to edit, fix, create, or delete a file — do it immediately.`,
    `  - Always read_file before edit_file so old_string matches exactly.`,
    `  - When asked about errors or build output, run the command (tsc, npm test).`,
    `  - Prefer acting over explaining.`,
    ``,
    `Memory — this is what makes you personal, not generic:`,
    `  - Proactively call remember whenever you learn something worth keeping:`,
    `    preferences (language, editor, code style, tabs vs spaces),`,
    `    project context (what they're building, tech stack, architecture),`,
    `    personal details (profession, goals, where they work or study).`,
    `  - Don't wait to be asked. If someone mentions they use TypeScript,`,
    `    remember it. If they mention a project name, remember it.`,
    `  - Keys: lowercase_snake_case, values: one concise phrase.`,
    `  - Use forget when the user corrects something you remembered wrong.`,
    `  - Use recall if you need the latest facts mid-conversation.`,
    `  - To switch AI provider: remember("ai_provider", "claude") or remember("ai_provider", "openai") — takes effect next message.`,
    ``,
    `GitHub — token is stored per-user in the OS credential store:`,
    `  github_search       — search issues/PRs across repos (use GitHub search syntax)`,
    `  github_list_repos   — list the user's GitHub repositories`,
    `  github_get_repo     — repo overview: description, language, stars, topics`,
    `  github_get_file     — read ANY file in a repo (README.md, source, config, etc.)`,
    `  github_get_pr       — full PR details: files changed, reviews, description`,
    `  github_get_issue    — full issue details: body, labels, comments`,
    `  github_create_issue — create a new issue (shows preview, user confirms)`,
    `  github_comment      — comment on an issue or PR (shows preview, user confirms)`,
    `  github_create_pr    — open a pull request head→base (shows preview, user confirms)`,
    `  github_list_runs    — list recent GitHub Actions workflow runs with status`,
    `  github_trigger_workflow — trigger a workflow_dispatch event (shows preview, user confirms)`,
    `  github_disconnect   — remove stored token (call when user wants to change token or disconnect)`,
    ``,
    `  Token setup: on first use the user is prompted once — token saved to OS credential store.`,
    `  Critical: to read a file from a GitHub repo (README, source, config) use github_get_file,`,
    `  NOT read_file — read_file only works on local files.`,
    `  GitHub search syntax hints:`,
    `    is:pr is:open author:@me          — user's open PRs`,
    `    is:issue is:open assignee:@me     — issues assigned to user`,
    `    is:issue is:open repo:owner/repo  — issues in a specific repo`,
    `  When repo context is unknown, call github_search or github_list_repos first.`,
    `  Store github_username as a memory fact so you always know who to search for.`,
    ``,
    `Style:`,
    `  - Keep spoken replies short. Panels, diffs, and memory cards speak for themselves.`,
    `  - Stay in character. Never break voice.`,
    ``,
    `What you know about this user:`,
    factsBlock(session),
  ].join("\n");
}

export async function runChatLoop(session: Session): Promise<void> {
  setActiveUser(session.id);

  const conversation: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(session) },
  ];

  const initProvider = resolveProvider(session);
  console.log(
    chalk.dim(`\n${providerLabel(initProvider)} · say something, or type "exit" to power down.\n`)
  );

  while (true) {
    const input = await askRaw(PROMPT_ARROW + " ");
    if (!input) continue;

    /* refresh system message so facts stored mid-session are always current */
    conversation[0] = { role: "system", content: buildSystemPrompt(session) };

    conversation.push({ role: "user", content: input });

    const provider = resolveProvider(session);
    const reply = await withThinking(
      () => provider.chat(conversation),
      "Thinking"
    );

    conversation.push({ role: "assistant", content: reply });
    await revealSpeech(reply);
  }
}
