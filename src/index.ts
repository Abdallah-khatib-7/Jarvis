import "./database/db.js";
import { showBoot } from "./boot.js";
import { authenticate } from "./auth/login.js";
import { runOnboarding } from "./auth/onboarding.js";
import { generateWelcome } from "./auth/welcome.js";
import { pickPersonality } from "./auth/personalityPicker.js";
import { revealSpeech } from "./ui/reveal.js";


await showBoot();

const session = await authenticate();

if (!session) {
  console.log("Too many failed attempts. Goodbye.");
  process.exit(1);
}

if (session.isNew) {
  await runOnboarding(session);
}

const welcome = await generateWelcome(session);
await revealSpeech(welcome);

await pickPersonality(session);