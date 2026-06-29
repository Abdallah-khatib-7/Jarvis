import OpenAI from "openai";
import "dotenv/config";
import type { AIProvider, ChatMessage } from "./types.js";

const MODEL = "gpt-4o-mini";

/* lazy client; throws a clear error if the key is missing rather than a vague SDK one */
function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your .env file.");
  }
  return new OpenAI({ apiKey: key });
}

export const openAIProvider: AIProvider = {
  name: "openai",

  async chat(messages: ChatMessage[]): Promise<string> {
    const client = getClient();
    const res = await client.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.9,
    });
    return res.choices[0]?.message?.content ?? "";
  },
};