import OpenAI from "openai";
import "dotenv/config";
import type { AIProvider, ChatMessage, ToolCall, MessageContent } from "./types.js";
import { TOOL_DEFINITIONS, runTool } from "../tools/registry.js";

const MODEL = "gpt-4o-mini";
const VISION_MODEL = "gpt-4o";
const MAX_TURNS = 10;

function hasImages(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image")
  );
}

function toContentParts(
  content: MessageContent
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((part) => {
    if (part.type === "text") return { type: "text" as const, text: part.text };
    return {
      type: "image_url" as const,
      image_url: { url: `data:${part.mimeType};base64,${part.base64}`, detail: "auto" as const },
    };
  });
}

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your .env file.");
  }
  return new OpenAI({ apiKey: key });
}

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

function toOpenAIMessages(
  messages: ChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: typeof m.content === "string" ? m.content : "",
        tool_call_id: m.toolCallId!,
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: typeof m.content === "string" ? m.content || null : null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    if (m.role === "user") {
      return { role: "user", content: toContentParts(m.content) };
    }
    return { role: m.role, content: typeof m.content === "string" ? m.content : "" };
  });
}

export const openAIProvider: AIProvider = {
  name: "openai",
  lastTokensUsed: 0,

  async chat(messages: ChatMessage[]): Promise<string> {
    const client = getClient();
    const conversation = [...messages];
    this.lastTokensUsed = 0;

    const model = hasImages(conversation) ? VISION_MODEL : MODEL;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await client.chat.completions.create({
        model,
        messages: toOpenAIMessages(conversation),
        tools: toOpenAITools(),
        temperature: 0.9,
      });
      this.lastTokensUsed += (res.usage?.prompt_tokens ?? 0) + (res.usage?.completion_tokens ?? 0);

      const choice = res.choices[0]?.message;
      if (!choice) return "";

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

      for (const call of toolCalls) {
        if (process.env.DEBUG) {
          console.log(`\n[tool call] ${call.name}(${JSON.stringify(call.arguments)})`);
        }
        const result = await runTool(call.name, call.arguments);
        if (process.env.DEBUG) {
          console.log(`[tool result] ok=${result.ok} output=${result.output.slice(0, 150)}\n`);
        }
        conversation.push({
          role: "tool",
          content: result.output,
          toolCallId: call.id,
        });
      }
    }

    const fallback = await client.chat.completions.create({
      model,
      messages: toOpenAIMessages(conversation),
      temperature: 0.9,
    });
    this.lastTokensUsed += (fallback.usage?.prompt_tokens ?? 0) + (fallback.usage?.completion_tokens ?? 0);
    return fallback.choices[0]?.message?.content ?? "I wasn't able to finish that one — try rephrasing.";
  },
};