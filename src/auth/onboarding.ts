import chalk from "chalk";
import { setFact } from "../database/memory.js";
import { deleteUser } from "../database/users.js";
import { askText, askRaw, askChoice, askConfirm } from "./prompts.js";
import { selfDestruct, underageFarewell } from "./effects.js";
import { panel, stepBadge } from "../ui/hud.js";
import type { Session } from "./login.js";

const MIN_AGE = 16;
const TOTAL_STEPS = 7;

function step(n: number, label: string): void {
  console.log(`\n${stepBadge(n, TOTAL_STEPS)}  ${chalk.bold.cyan(label)}`);
}

function parseAge(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 120) return null;
  return n;
}

async function askAge(session: Session): Promise<number> {
  let warned = false;

  while (true) {
    const raw = await askRaw("How old are you?");
    const age = parseAge(raw);

    if (age === null) {
      if (!warned) {
        console.log(
          chalk.yellow.bold("\nI am JARVIS. You can't fool me with that.\n") +
            chalk.yellow("Enter a real age. LAST TRY.\n")
        );
        warned = true;
        continue;
      }
      await selfDestruct();
      deleteUser(session.id);
      process.exit(0);
    }

    if (age < MIN_AGE) {
      await underageFarewell();
      deleteUser(session.id);
      process.exit(0);
    }

    return age;
  }
}

/* asks major only for university; keeps the branch in one place */
async function askMajor(session: Session): Promise<void> {
  const major = await askText("What's your major?");
  if (major.trim()) setFact(session.id, "major", major.trim());
}

/* records the picked level and chases the right follow-up */
async function recordLevel(session: Session, level: string): Promise<void> {
  setFact(session.id, "education_level", level);

  if (level === "university") {
    console.log(
      chalk.cyan("\nUniversity already — early access at your age. Impressive.\n")
    );
    await askMajor(session);
  } else if (level === "not_in_school") {
    console.log(
      chalk.cyan("\nGot it — learning happens everywhere, not just classrooms.\n")
    );
  }
}

/* age-aware: under 18 JARVIS guesses high school and confirms; 18+ asks plainly */
async function educationFlow(session: Session, age: number): Promise<void> {
  if (age < 18) {
    const guessed = await askConfirm(
      `Since you're ${age}, I'd guess you're in high school — am I right?`
    );

    if (guessed) {
      await recordLevel(session, "high_school");
      return;
    }

    const level = await askChoice("My mistake. Where do you actually stand?", [
      { name: "University / college", value: "university" },
      { name: "Already graduated", value: "graduated" },
      { name: "Not in school / other", value: "not_in_school" },
    ]);
    await recordLevel(session, level);
    return;
  }

  /* 18+ is genuinely ambiguous, so ask outright */
  const status = await askChoice("Are you a student or a graduate?", [
    { name: "Student", value: "student" },
    { name: "Graduate", value: "graduated" },
    { name: "Neither", value: "not_in_school" },
  ]);

  if (status === "student") {
    const level = await askChoice("Where are you studying?", [
      { name: "High school", value: "high_school" },
      { name: "University", value: "university" },
    ]);
    await recordLevel(session, level);
  } else {
    await recordLevel(session, status);
  }
}

export async function runOnboarding(session: Session): Promise<void> {
  panel(
    { icon: "◈", title: "GETTING TO KNOW YOU", color: chalk.cyan },
    [
      chalk.white("A short dossier — seven questions, then I won't ask again."),
      chalk.dim("Everything you tell me is remembered for every session after this one."),
    ]
  );

  step(1, "Name");
  const name = await askText("What should I call you?");
  if (name.trim()) setFact(session.id, "preferred_name", name.trim());

  step(2, "Gender");
  const gender = await askChoice("Your gender?", [
    { name: "Male", value: "male" },
    { name: "Female", value: "female" },
    { name: "Prefer not to say", value: "unspecified" },
  ]);
  setFact(session.id, "gender", gender);

  step(3, "Age");
  const age = await askAge(session);
  setFact(session.id, "age", String(age));

  step(4, "Education");
  await educationFlow(session, age);

  step(5, "Role");
  const role = await askText("And what do you do? (your role or job)");
  if (role.trim()) setFact(session.id, "role", role.trim());

  step(6, "About you");
  const about = await askText("Describe yourself in a sentence or two.");
  if (about.trim()) setFact(session.id, "about", about.trim());

  step(7, "One last thing");
  const dessert = await askText("Your favorite dessert?");
  if (dessert.trim()) setFact(session.id, "favorite_dessert", dessert.trim());

  panel(
    { icon: "✓", title: "DOSSIER COMPLETE", color: chalk.green },
    [chalk.white("Noted. I'll remember all of that.")]
  );
}
