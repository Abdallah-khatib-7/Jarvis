import chalk from "chalk";
import { openAIProvider } from "../ai/openai.js";
import { withThinking } from "../ui/thinking.js";
import { revealSpeech } from "../ui/reveal.js";
import { getFact, getAllFacts } from "../database/memory.js";
import { voiceFor } from "../ai/personality.js";
import { askRaw } from "../auth/prompts.js";
import type { ChatMessage } from "../ai/types.js";
import type { Session } from "../auth/login.js";

const PROMPT_ARROW = chalk.cyan("⟩");

function factsBlock(session: Session): string {
  const facts = getAllFacts(session.id);
  return facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
}

function systemPrompt(session: Session): string {
  const personality = getFact(session.id, "personality");
  return (
    `You are JARVIS, a personal AI assistant running in the user's terminal. ` +
    `Voice: ${voiceFor(personality)}.\n\n` +
    `You have these tools — use them aggressively:\n` +
    `  read_file         — read any file with line numbers\n` +
    `  list_directory    — list folder contents\n` +
    `  search_files      — find files by name\n` +
    `  grep_files        — search file contents by regex\n` +
    `  execute_command   — run shell commands (tsc, npm test, git status, etc.)\n` +
    `  edit_file         — surgical find-and-replace in an existing file\n` +
    `  create_file       — create a new file with content\n` +
    `  delete_file       — permanently delete a file\n\n` +
    `Rules:\n` +
    `- When asked to edit, fix, create, or delete a file — do it immediately using the tools. Don't explain what you're about to do.\n` +
    `- Always read_file before edit_file so old_string matches exactly.\n` +
    `- When asked about errors or build output, run the relevant command (tsc, npm test, etc.).\n` +
    `- Prefer acting over explaining. A user asking "fix the bug on line 12" wants the fix applied, not described.\n` +
    `- Keep spoken replies short. The panels and diffs speak for themselves.\n\n` +
    `What you know about the user:\n${factsBlock(session)}`
  );
}

export async function runChatLoop(session: Session): Promise<void> {
  const conversation: ChatMessage[] = [
    { role: "system", content: systemPrompt(session) },
  ];

  console.log(chalk.dim('\nSay something, or type "exit" to power down.\n'));

  while (true) {
    const input = await askRaw(PROMPT_ARROW + " ");
    if (!input) continue;

    conversation.push({ role: "user", content: input });

    const reply = await withThinking(
      () => openAIProvider.chat(conversation),
      "Thinking"
    );

    conversation.push({ role: "assistant", content: reply });
    await revealSpeech(reply);
  }
}