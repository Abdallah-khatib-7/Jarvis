import OpenAI from "openai";
import "dotenv/config";
import type { AIProvider, ChatMessage, ToolCall } from "./types.js";
import { TOOL_DEFINITIONS, runTool } from "../tools/registry.js";

const MODEL = "gpt-4o-mini";
const MAX_TURNS = 6;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your .env file.");
  }
  return new OpenAI({ apiKey: key });
}

/* translate our generic tool shape into OpenAI's exact function-calling format */
function toOpenAITools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return TOOL_DEFINITIONS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/* our ChatMessage -> OpenAI's expected message shape */
function toOpenAIMessages(
  messages: ChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content,
        tool_call_id: m.toolCallId!,
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

export const openAIProvider: AIProvider = {
  name: "openai",

  async chat(messages: ChatMessage[]): Promise<string> {
    const client = getClient();
    const conversation = [...messages];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await client.chat.completions.create({
        model: MODEL,
        messages: toOpenAIMessages(conversation),
        tools: toOpenAITools(),
        temperature: 0.9,
      });

      const choice = res.choices[0]?.message;
      if (!choice) return "";

      /* no tool calls: this is the final answer */
      if (!choice.tool_calls?.length) {
        return choice.content ?? "";
      }

      const toolCalls: ToolCall[] = choice.tool_calls
        .filter((tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
          tc.type === "function"
        )
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || "{}"),
        }));

      conversation.push({
        role: "assistant",
        content: choice.content ?? "",
        toolCalls,
      });

      /* run each requested tool, feed results back as tool messages */
      for (const call of toolCalls) {
        const result = await runTool(call.name, call.arguments);
        conversation.push({
          role: "tool",
          content: result.output,
          toolCallId: call.id,
        });
      }
    }

    return "I've hit my tool-use limit for this turn — try rephrasing.";
  },
};