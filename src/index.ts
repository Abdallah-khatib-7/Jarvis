import "./database/db.js";
import { showBoot } from "./boot.js";
import { authenticate } from "./auth/login.js";

await showBoot();

const session = await authenticate();

if (!session) {
  console.log("Too many failed attempts. Goodbye.");
  process.exit(1);
}

console.log(`\nSession started for ${session.username}.`);