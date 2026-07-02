import './database/db.js'; // Database connection
import { showBoot } from './boot.js'; // Boot sequence
import { authenticate } from './auth/login.js'; // User authentication
import { runOnboarding } from "./auth/onboarding.js";
import { generateWelcome } from "./auth/welcome.js";
import { pickPersonality } from "./auth/personalityPicker.js";
import { revealSpeech } from "./ui/reveal.js";
import { runChatLoop } from "./chat/loop.js";

await showBoot();

const session = await authenticate();

if (!session) {
  process.exit(1);
}

if (session.isNew) {
  await runOnboarding(session);
  const welcome = await generateWelcome(session);
  await revealSpeech(welcome);
  await pickPersonality(session);
}

await runChatLoop(session);