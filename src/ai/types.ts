export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/* the one shape every provider must speak; the app talks to this, never to a vendor SDK */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
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