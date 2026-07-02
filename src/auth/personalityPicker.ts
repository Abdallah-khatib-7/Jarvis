import chalk from "chalk";
import { setFact } from "../database/memory.js";
import { askChoice } from "./prompts.js";
import { PERSONALITIES, DEFAULT_PERSONALITY } from "../ai/personality.js";
import { panel } from "../ui/hud.js";
import type { Session } from "./login.js";

/* short in-character line per personality; no regeneration, just flavor on the confirm */
const CONFIRM_LINES: Record<string, string> = {
  cinematic: "Noted. I'll keep things composed.",
  warm: "Noted. I'll keep it friendly.",
  playful: "Noted. Don't say I didn't warn you.",
  professional: "Noted. Straight to business from here.",
};

const ICONS: Record<string, string> = {
  cinematic: "◈",
  warm: "◉",
  playful: "◎",
  professional: "◇",
};

export async function pickPersonality(session: Session): Promise<void> {
  panel(
    { icon: "◈", title: "CALIBRATE VOICE", color: chalk.magenta },
    [chalk.white("One more thing — how should I sound?")]
  );

  const choice = await askChoice(
    "Shall I keep this tone, or would you prefer another?",
    PERSONALITIES.map((p) => ({ name: p.label, value: p.key }))
  );

  setFact(session.id, "personality", choice);

  const line = CONFIRM_LINES[choice] ?? CONFIRM_LINES[DEFAULT_PERSONALITY];
  const icon = ICONS[choice] ?? ICONS[DEFAULT_PERSONALITY];
  panel({ icon, title: "VOICE SET", color: chalk.magenta }, [chalk.white(line)]);
}