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
    `You are JARVIS, a personal AI assistant. Voice: ${voiceFor(personality)}. ` +
    `You have real tools available (reading files, listing directories) — use them ` +
    `whenever a question needs real information instead of guessing. ` +
    `Keep replies conversational, not robotic. Stay in character.\n\n` +
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