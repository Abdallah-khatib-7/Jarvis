import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import type { AIProvider, ChatMessage, ToolCall, MessageContent } from "./types.js";
import { TOOL_DEFINITIONS, runTool } from "../tools/registry.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 10;

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set. Add it to your .env file.");
  return new Anthropic({ apiKey: key });
}

function toAnthropicTools(): Anthropic.Tool[] {
  return TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: t.parameters.properties,
      required: t.parameters.required,
    },
  }));
}

function toClaudeContent(content: MessageContent): Anthropic.ContentBlockParam[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((part): Anthropic.ContentBlockParam => {
    if (part.type === "text") return { type: "text", text: part.text };
    return {
      type: "image",
      source: { type: "base64", media_type: part.mimeType, data: part.base64 },
    };
  });
}

function toAnthropicMessages(messages: ChatMessage[]): {
  system: string;
  msgs: Anthropic.MessageParam[];
} {
  let system = "";
  const msgs: Anthropic.MessageParam[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "system") {
      system = typeof msg.content === "string" ? msg.content : "";
      i++;
      continue;
    }

    if (msg.role === "user") {
      msgs.push({ role: "user", content: toClaudeContent(msg.content) });
      i++;
      continue;
    }

    if (msg.role === "assistant") {
      if (msg.toolCalls?.length) {
        const content: Anthropic.ContentBlockParam[] = [];
        const assistantText = typeof msg.content === "string" ? msg.content : "";
        if (assistantText) {
          content.push({ type: "text", text: assistantText });
        }
        for (const tc of msg.toolCalls) {
          const block: Anthropic.ToolUseBlockParam = {
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          };
          content.push(block);
        }
        msgs.push({ role: "assistant", content });
      } else {
        msgs.push({ role: "assistant", content: typeof msg.content === "string" ? msg.content : "" });
      }
      i++;
      continue;
    }

    if (msg.role === "tool") {
      /* Anthropic requires all tool results for one assistant turn to be
         bundled into a single user message — collect them all before pushing */
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      while (i < messages.length && messages[i].role === "tool") {
        toolResults.push({
          type: "tool_result",
          tool_use_id: messages[i].toolCallId!,
          content: typeof messages[i].content === "string" ? messages[i].content as string : "",
        });
        i++;
      }
      msgs.push({ role: "user", content: toolResults });
      continue;
    }

    i++;
  }

  return { system, msgs };
}

export const claudeProvider: AIProvider = {
  name: "claude",
  lastTokensUsed: 0,

  async chat(messages: ChatMessage[]): Promise<string> {
    const client = getClient();
    const conversation = [...messages];
    this.lastTokensUsed = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const { system, msgs } = toAnthropicMessages(conversation);

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        messages: msgs,
        tools: toAnthropicTools(),
      });
      this.lastTokensUsed += response.usage.input_tokens + response.usage.output_tokens;

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
        return textBlocks.map((b) => b.text).join("");
      }

      const toolCalls: ToolCall[] = toolUseBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        arguments: b.input as Record<string, unknown>,
      }));

      conversation.push({
        role: "assistant",
        content: textBlocks.map((b) => b.text).join(""),
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

    return "I reached the turn limit on that one. Try breaking it into smaller steps.";
  },
};
