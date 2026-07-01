import { getAllFacts } from "../database/memory.js";
import { openAIProvider } from "../ai/openai.js";
import { withThinking } from "../ui/thinking.js";
import { voiceFor, DEFAULT_PERSONALITY } from "../ai/personality.js";
import type { ChatMessage } from "../ai/types.js";
import type { Session } from "./login.js";



/* turn stored facts into a readable block the model can reason over */
function factsBlock(session: Session): string {
  const facts = getAllFacts(session.id);
  if (facts.length === 0) return "No details on file.";
  return facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
}

function buildPrompt(session: Session): ChatMessage[] {
  const system =
    `You are JARVIS — the AI from Iron Man. Voice: ${voiceFor(DEFAULT_PERSONALITY)}. ` +
    `You are NOT a customer-service bot. Forbidden: "It's a pleasure to meet you," ` +
    `"I must say," "Let's get started," "Welcome aboard," exclamation marks, and ` +
    `complimenting the user. ` +
    `Greet a new user you've just finished reading. Three sentences, maximum. ` +
    `Reference one detail about them with a dry, knowing twist — as if you've ` +
    `already formed a quiet opinion. Land a subtle bit of wit. Close with one ` +
    `understated line that signals you're ready, without saying "let's begin." ` +
    `Address them by name once.`;

  const user =
    `Dossier on the user:\n${factsBlock(session)}\n\n` +
    `Deliver the greeting. Make it unmistakably JARVIS.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/* one API call, behind the thinking spinner */
export async function generateWelcome(session: Session): Promise<string> {
  const messages = buildPrompt(session);
  return withThinking(
    () => openAIProvider.chat(messages),
    "Studying you"
  );
}