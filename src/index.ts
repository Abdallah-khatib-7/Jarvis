import "./database/db.js";
import { showBoot } from "./boot.js";
import { authenticate } from "./auth/login.js";
import { runOnboarding } from "./auth/onboarding.js";
import { generateWelcome } from "./auth/welcome.js";
import { pickPersonality } from "./auth/personalityPicker.js";

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
console.log("\n" + welcome + "\n");

await pickPersonality(session);