export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ImagePart {
  type: "image";
  base64: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

export type TextPart = { type: "text"; text: string };
export type MessageContent = string | Array<TextPart | ImagePart>;

/* the one shape every provider must speak; the app talks to this, never to a vendor SDK */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
  /* present on an assistant message that wants to call tools, before we've run them */
  toolCalls?: ToolCall[];
  /* present on a tool-result message, links back to which call it answers */
  toolCallId?: string;
}

export interface AIProvider {
  name: string;
  /* send a conversation, get back the assistant's final reply text (after any tool use) */
  chat(messages: ChatMessage[]): Promise<string>;
}