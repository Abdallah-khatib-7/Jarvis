/* the app-wide voice options; one source of truth for every AI call */
export interface Personality {
  key: string;
  label: string;
  voice: string;
}

export const PERSONALITIES: Personality[] = [
  {
    key: "cinematic",
    label: "Cool & cinematic — calm, Iron Man's JARVIS",
    voice:
      "calm, dry wit, unflappable, quietly amused — precise, with a faint smirk, never servile",
  },
  {
    key: "warm",
    label: "Warm & witty — friendly, light humor",
    voice:
      "warm, friendly, lightly humorous — approachable and encouraging, but never saccharine",
  },
  {
    key: "playful",
    label: "Playful & cheeky — more jokes, teasing",
    voice:
      "playful, cheeky, quick with a joke — teases affectionately, keeps things light",
  },
  {
    key: "professional",
    label: "Serious & professional — focused, no-nonsense",
    voice:
      "focused, precise, no-nonsense — efficient and direct, minimal flourish",
  },
];

export const DEFAULT_PERSONALITY = "cinematic";

/* look up a voice by key; falls back to default if missing */
export function voiceFor(key: string | undefined): string {
  const found = PERSONALITIES.find((p) => p.key === key);
  return (found ?? PERSONALITIES.find((p) => p.key === DEFAULT_PERSONALITY)!)
    .voice;
}