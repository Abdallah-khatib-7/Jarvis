import chalk from "chalk";
import { openAIProvider } from "../ai/openai.js";
import { withThinking } from "../ui/thinking.js";
import { revealSpeech } from "../ui/reveal.js";
import { getFact, getAllFacts } from "../database/memory.js";
import { voiceFor } from "../ai/personality.js";
import { askRaw } from "../auth/prompts.js";
import { setActiveUser } from "../tools/memoryTools.js";
import type { ChatMessage } from "../ai/types.js";
import type { Session } from "../auth/login.js";

const PROMPT_ARROW = chalk.cyan("⟩");

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

  console.log(chalk.dim('\nSay something, or type "exit" to power down.\n'));

  while (true) {
    const input = await askRaw(PROMPT_ARROW + " ");
    if (!input) continue;

    /* refresh system message so facts stored mid-session are always current */
    conversation[0] = { role: "system", content: buildSystemPrompt(session) };

    conversation.push({ role: "user", content: input });

    const reply = await withThinking(
      () => openAIProvider.chat(conversation),
      "Thinking"
    );

    conversation.push({ role: "assistant", content: reply });
    await revealSpeech(reply);
  }
}
