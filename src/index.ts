import "./database/db.js";
import { showBoot } from "./boot.js";
import { authenticate } from "./auth/login.js";
import { runOnboarding } from "./auth/onboarding.js";

await showBoot();

const session = await authenticate();

if (!session) {
  console.log("Too many failed attempts. Goodbye.");
  process.exit(1);
}

if (session.isNew) {
  await runOnboarding(session);
}

console.log(`\nSession started for ${session.username}.`);