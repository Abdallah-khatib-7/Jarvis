/* the one shape every provider must speak; the app talks to this, never to a vendor SDK */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  /* send a conversation, get back the assistant's reply text */
  chat(messages: ChatMessage[]): Promise<string>;
}