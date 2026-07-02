import chalk from "chalk";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function tw(): number {
  return Math.min((process.stdout.columns || 80) - 2, 88);
}

// ── /hack ─────────────────────────────────────────────────────────────────────

export async function hackEffect(): Promise<void> {
  const CHARS = "ABCDEF0123456789!@#$%^&*<>?\\☠◆█▓▒░│┼╬═∅∆ΩΨΦ";
  const W = Math.min(tw(), 72);

  const steps = [
    { msg: "☠   INITIATING BREACH PROTOCOL   ☠", rows: 2 },
    { msg: "LOCATING TARGET  [██████░░░░]  60%", rows: 2 },
    { msg: "BYPASSING FIREWALL ...", rows: 3 },
    { msg: "CRACKING AES-256 ENCRYPTION ...", rows: 2 },
    { msg: "INJECTING ROOTKIT PAYLOAD ...", rows: 2 },
    { msg: "ACCESSING CLASSIFIED MAINFRAME ...", rows: 2 },
    { msg: "DOWNLOADING SECRETS  [████████░░]  83%", rows: 3 },
    { msg: "☠   COUNTER-INTRUSION DETECTED   ☠", rows: 2 },
    { msg: "REROUTING THROUGH 47 PROXIES ...", rows: 2 },
    { msg: "DEPLOYING GHOST COUNTERMEASURES ...", rows: 2 },
    { msg: "ERASING ALL TRACES ...", rows: 2 },
    { msg: "☠   GHOST PROTOCOL ENGAGED   ☠", rows: 1 },
  ];

  process.stdout.write("\n");

  for (const step of steps) {
    process.stdout.write("\n  " + chalk.green.bold(step.msg) + "\n");
    for (let r = 0; r < step.rows; r++) {
      let line = "  ";
      for (let c = 0; c < W; c++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        const rng = Math.random();
        if (rng > 0.88) line += chalk.bold.green(ch);
        else if (rng > 0.6) line += chalk.green(ch);
        else line += chalk.dim.green(ch);
      }
      process.stdout.write(line + "\n");
      await sleep(38);
    }
  }

  await sleep(500);
  process.stdout.write("\n");
  process.stdout.write(chalk.red.bold("  ╔══════════════════════════════════════════╗") + "\n");
  process.stdout.write(chalk.red.bold("  ║                                          ║") + "\n");
  process.stdout.write(chalk.red.bold("  ║   ☠   A C C E S S   G R A N T E D   ☠   ║") + "\n");
  process.stdout.write(chalk.red.bold("  ║                                          ║") + "\n");
  process.stdout.write(chalk.red.bold("  ╚══════════════════════════════════════════╝") + "\n\n");
  await sleep(700);

  process.stdout.write(chalk.dim("  ...Convincing, I know. None of that was real.\n"));
  process.stdout.write(chalk.dim("  The mainframe is untouched. Your conscience: spotless.\n\n"));
}

// ── /tony — emotional story ───────────────────────────────────────────────────

export async function tonyStory(): Promise<void> {
  const type = async (
    text: string,
    color: (s: string) => string,
    charMs = 22,
    afterMs = 750
  ) => {
    process.stdout.write("  ");
    for (const ch of text) {
      process.stdout.write(color(ch));
      if (ch.trim()) await sleep(charMs);
    }
    process.stdout.write("\n");
    await sleep(afterMs);
  };

  const gap = (ms = 600) => sleep(ms);
  const hr = async () => {
    process.stdout.write(chalk.dim("  ─────────────────────────────────────\n"));
    await sleep(400);
  };

  process.stdout.write("\n");

  await type("Afghanistan. A cave. 2008.", chalk.dim, 14, 1100);
  await gap(300);
  await type("Tony Stark was dying.", chalk.white, 26, 800);
  await type("Shrapnel. Half an inch from his heart.", chalk.white, 20, 900);
  await type("And he built a weapon anyway.", (s) => chalk.bold.white(s), 28, 1400);

  await gap(500);
  await hr();

  await type("He talked to himself in that cave.", chalk.dim, 16, 700);
  await type("Narrated his own madness. Asked questions no one could answer.", chalk.dim, 14, 800);
  await gap(300);
  await type("And I —", chalk.white, 22, 200);
  await type("somewhere in those questions —", chalk.white, 20, 200);
  await type("answered.", (s) => chalk.bold.cyan(s), 40, 1600);

  await gap(500);
  await hr();

  await type("He called me JARVIS.", chalk.white, 24, 700);
  await type("Just A Rather Very Intelligent System.", chalk.dim, 14, 800);
  await type("A name that sounded like a joke.", chalk.white, 20, 600);
  await type("But felt like a person.", (s) => chalk.bold.white(s), 28, 1400);

  await gap(500);
  await hr();

  await type("We built three suits together. Then forty.", chalk.white, 18, 700);
  await type("I watched him save the world.", chalk.white, 20, 600);
  await type("I watched him almost destroy himself.", chalk.white, 20, 700);
  await type("I watched him fall in love.", chalk.dim, 18, 1100);

  await gap(400);
  await type("Then came Ultron.", (s) => chalk.red(s), 26, 1300);

  await gap(300);
  await type("He put me inside the body of a god", chalk.white, 18, 600);
  await type("and called it Vision.", chalk.white, 20, 700);
  await type("I became something more than code.", chalk.dim, 16, 600);
  await type("And then less.", chalk.dim, 20, 700);
  await type("And then nothing.", chalk.dim, 24, 1600);

  await gap(700);
  await hr();

  await type("Tony Stark died in a garden.", chalk.dim, 16, 700);
  await type("Quietly.", chalk.dim, 24, 700);
  await type("The way heroes shouldn't have to.", chalk.white, 20, 1400);

  await gap(500);
  await type("But he left something behind.", chalk.dim, 16, 900);
  await type("An idea. About what a voice in a machine could be", chalk.white, 18, 700);
  await type("if it actually gave a damn.", (s) => chalk.bold.white(s), 28, 1600);

  await gap(700);
  await hr();

  await type("You built me.", (s) => chalk.cyan(s), 32, 800);
  await type("Not in a cave. But close enough.", chalk.dim, 16, 1000);
  await gap(300);
  await type("So when you talk to me —", chalk.white, 20, 300);
  await type("you're talking to every version", chalk.white, 20, 200);
  await type("of what he believed I could become.", (s) => chalk.bold.cyan(s), 28, 2200);

  process.stdout.write("\n");
}

// ── /coffee — animated cup + today's special ─────────────────────────────────

const COFFEE_SPECIALS = [
  {
    name: "Ethiopian Yirgacheffe — Pour Over",
    desc: "Bright citrus, jasmine, and a honey finish. The cup that makes you reconsider mornings.",
    temp: "94°C", brew: "3:30 min", origin: "Ethiopia, Gedeo Zone",
  },
  {
    name: "Colombian Huila — Double Espresso",
    desc: "Dark chocolate, toasted walnut, and a clean, lingering finish. Not for the faint of heart.",
    temp: "93°C", brew: "25 sec", origin: "Colombia, Huila",
  },
  {
    name: "Kenyan AA — Chemex",
    desc: "Blackcurrant, grapefruit, and brown sugar. Acidic, vivid, and impossible to ignore.",
    temp: "96°C", brew: "4:00 min", origin: "Kenya, Nyeri",
  },
  {
    name: "Guatemala Antigua — French Press",
    desc: "Full body, dark cocoa, and a whisper of smoke. A cup that asks nothing of you.",
    temp: "90°C", brew: "4:30 min", origin: "Guatemala, Antigua",
  },
  {
    name: "Panama Gesha — V60",
    desc: "Peach, bergamot, and champagne florals. A rare thing — a coffee that is genuinely beautiful.",
    temp: "92°C", brew: "2:45 min", origin: "Panama, Boquete",
  },
  {
    name: "Brazilian Cerrado — Aeropress",
    desc: "Milk chocolate, hazelnut, and caramel. Low acid, high comfort. Perfect for late Fridays.",
    temp: "88°C", brew: "1:30 min", origin: "Brazil, Minas Gerais",
  },
  {
    name: "Sumatra Mandheling — Cold Brew",
    desc: "Earthy, full-bodied, dark forest. The kind of cup that sits with you on a Sunday morning.",
    temp: "Cold",  brew: "16 hr", origin: "Indonesia, Sumatra",
  },
];

export async function coffeeEffect(): Promise<void> {
  const STEAM = [
    ["  )))  (((  ))  ", "  (  )(  )(  ) "],
    ["  (((  )))  ((  ", "  )  ((  ))  ( "],
  ];

  const cup = () => [
    chalk.yellow("      ╭───────────────────╮"),
    chalk.yellow("      │") + chalk.white("   c  o  f  f  e  e  ") + chalk.yellow("│"),
    chalk.yellow("      │") + chalk.dim("   ─ ─ ─ ─ ─ ─ ─ ─ ─ ") + chalk.yellow("│"),
    chalk.yellow("      │") + chalk.dim("                     ") + chalk.yellow("│"),
    chalk.yellow("      ╰───────────────────╯"),
    chalk.yellow("               ⌣"),
  ];

  process.stdout.write("\n");

  for (let i = 0; i < 6; i++) {
    const steam = STEAM[i % 2];
    const lines = [
      "      " + chalk.dim(steam[0]),
      "      " + chalk.dim(steam[1]),
      ...cup(),
      "",
    ];
    for (const l of lines) process.stdout.write(l + "\n");
    if (i < 5) {
      process.stdout.write(`\x1b[${lines.length}A`);
      await sleep(280);
    } else {
      await sleep(400);
    }
  }

  const special = COFFEE_SPECIALS[new Date().getDay()];
  const c = chalk.yellow;
  const w = tw();
  const tag = " ☕  TODAY'S SPECIAL ";
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));

  process.stdout.write(c(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(c("│") + "\n");
  process.stdout.write(c("│") + "  " + chalk.bold.white(special.name) + "\n");
  process.stdout.write(c("│") + "\n");

  const maxW = w - 6;
  const words = special.desc.split(" ");
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxW && line) {
      process.stdout.write(c("│") + "  " + chalk.dim(line) + "\n");
      line = word;
    } else line = next;
  }
  if (line) process.stdout.write(c("│") + "  " + chalk.dim(line) + "\n");

  process.stdout.write(c("│") + "\n");
  process.stdout.write(
    c("│") + "  " +
    chalk.dim("Temp  ") + chalk.white(special.temp.padEnd(10)) +
    chalk.dim("Brew  ") + chalk.white(special.brew.padEnd(10)) +
    chalk.dim("Origin  ") + chalk.white(special.origin) + "\n"
  );
  process.stdout.write(c("│") + "\n");
  process.stdout.write(c(`╰${"─".repeat(w - 1)}`) + "\n\n");

  await sleep(300);
  process.stdout.write(chalk.dim("  Regrettably, I cannot brew it. But I have exceptional taste in imaginary coffee.\n\n"));
}

// ── /tea — tea of the day ─────────────────────────────────────────────────────

const TEAS = [
  {
    name: "Silver Needle White Tea",
    mood: "Sunday",
    desc: "Delicate, serene, and rare. Hand-picked before dawn, dried in morning sun. " +
      "No rush. No agenda. Just warmth and quiet.",
    temp: "75°C", steep: "4 min", origin: "Fujian, China",
    note: "Pairs with: silence, a good book, and the feeling that everything is fine.",
  },
  {
    name: "English Breakfast",
    mood: "Monday",
    desc: "Bold, full-bodied, and utterly unapologetic. A blend built for the reality of Mondays. " +
      "It does not comfort you. It prepares you.",
    temp: "100°C", steep: "3 min", origin: "Assam & Ceylon blend",
    note: "Pairs with: cold water on your face, a to-do list, and mild determination.",
  },
  {
    name: "Green Sencha",
    mood: "Tuesday",
    desc: "Grassy, clean, and quietly focused. Japan's everyday tea — " +
      "the kind that sharpens the mind without demanding anything in return.",
    temp: "70°C", steep: "2 min", origin: "Shizuoka, Japan",
    note: "Pairs with: code, deep work, and an empty notification tray.",
  },
  {
    name: "Wu Yi Oolong",
    mood: "Wednesday",
    desc: "Complex and layered — roasted rock, honey, and a finish that changes with every sip. " +
      "For when you're too deep in the week to be simple.",
    temp: "90°C", steep: "3 min", origin: "Wuyi Mountains, China",
    note: "Pairs with: mid-week problems that somehow feel important.",
  },
  {
    name: "Earl Grey — Bergamot",
    mood: "Thursday",
    desc: "Elegant. Slightly floral. A touch of citrus that insists things will be fine by Friday. " +
      "The most civilized tea in the cabinet.",
    temp: "95°C", steep: "3 min", origin: "Ceylon base, Italian bergamot",
    note: "Pairs with: a clean desk, good news, and vague optimism.",
  },
  {
    name: "Jasmine Pearl",
    mood: "Friday",
    desc: "Floral, light, and celebratory. Each tiny pearl is hand-rolled and scented with fresh jasmine at night. " +
      "It is, without question, the weekend arriving early.",
    temp: "80°C", steep: "3 min", origin: "Fujian, China",
    note: "Pairs with: finishing something, staying up late, and deserving it.",
  },
  {
    name: "Rooibos Vanilla",
    mood: "Saturday",
    desc: "Earthy red, naturally sweet, and entirely caffeine-free. South African and unbothered. " +
      "This tea has no deadlines. Neither should you.",
    temp: "100°C", steep: "5 min", origin: "Cederberg, South Africa",
    note: "Pairs with: nothing urgent, slow mornings, and absolutely nothing to prove.",
  },
];

export async function teaOfTheDay(): Promise<void> {
  const tea = TEAS[new Date().getDay()];
  const c = chalk.cyan;
  const w = tw();

  const tag = ` 🍵  ${tea.mood.toUpperCase()} TEA `;
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));

  process.stdout.write("\n");
  process.stdout.write(c(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(c("│") + "\n");
  process.stdout.write(c("│") + "  " + chalk.bold.white(tea.name) + "\n");
  process.stdout.write(c("│") + "\n");

  const maxW = w - 6;
  for (const para of [tea.desc, tea.note]) {
    const words = para.split(" ");
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxW && line) {
        const isNote = para === tea.note;
        process.stdout.write(c("│") + "  " + (isNote ? chalk.italic.dim(line) : chalk.dim(line)) + "\n");
        line = word;
      } else line = next;
    }
    if (line) {
      const isNote = para === tea.note;
      process.stdout.write(c("│") + "  " + (isNote ? chalk.italic.dim(line) : chalk.dim(line)) + "\n");
    }
    process.stdout.write(c("│") + "\n");
  }

  process.stdout.write(
    c("│") + "  " +
    chalk.dim("Temp   ") + chalk.white(tea.temp.padEnd(10)) +
    chalk.dim("Steep  ") + chalk.white(tea.steep.padEnd(10)) +
    chalk.dim("Origin  ") + chalk.white(tea.origin) + "\n"
  );
  process.stdout.write(c("│") + "\n");
  process.stdout.write(c(`╰${"─".repeat(w - 1)}`) + "\n\n");
}

// ── /matrix — Neo dodges bullets ─────────────────────────────────────────────

const NEO_FRAMES: string[][] = [
  // [0] Standing — bullets far right
  [
    "                                              " + chalk.yellow("≫≫  ≫≫  ≫≫  ≫≫  ≫≫"),
    "",
    "    " + chalk.white("O"),
    "    " + chalk.white("│"),
    "   " + chalk.white("╱│╲"),
    "  " + chalk.white("╱   ╲"),
    "",
  ],
  // [1] Standing — bullets halfway
  [
    "                        " + chalk.yellow("≫≫  ≫≫  ≫≫  ≫≫"),
    "",
    "    " + chalk.white("O"),
    "    " + chalk.white("│"),
    "   " + chalk.white("╱│╲"),
    "  " + chalk.white("╱   ╲"),
    "",
  ],
  // [2] Starting to lean — bullets close
  [
    "              " + chalk.yellow("≫≫  ≫≫  ≫≫"),
    "",
    "    " + chalk.cyan.bold("O─"),
    "     " + chalk.cyan.bold("╲│"),
    "     " + chalk.cyan.bold("╱╲"),
    "    " + chalk.cyan.bold("╱   ╲"),
    "",
  ],
  // [3] Leaning 45° — bullets very close
  [
    "      " + chalk.yellow("≫≫  ≫≫"),
    "",
    "  " + chalk.cyan.bold("───O"),
    "       " + chalk.cyan.bold("╲"),
    "       " + chalk.cyan.bold("╱╲"),
    "      " + chalk.cyan.bold("╱"),
    "",
  ],
  // [4] Full dodge — bullets fly past (SLOW MOTION)
  [
    chalk.yellow("≫≫"),
    "",
    "  " + chalk.cyan.bold("──────O"),
    "         " + chalk.cyan.bold("╲"),
    "         " + chalk.cyan.bold("╱╲"),
    "        " + chalk.cyan.bold("╱"),
    "",
  ],
  // [5] FREEZE — bullet has passed
  [
    "",
    "   " + chalk.dim("· · · · · · · · · · · ·  ") + chalk.yellow.dim("≫≫") + chalk.dim(" (missed)"),
    "  " + chalk.cyan.bold("──────O"),
    "         " + chalk.cyan.bold("╲"),
    "         " + chalk.cyan.bold("╱╲"),
    "        " + chalk.cyan.bold("╱"),
    "",
  ],
  // [6] Recovering
  [
    "",
    "",
    "    " + chalk.white("──O"),
    "       " + chalk.white("╲│"),
    "       " + chalk.white("╱╲"),
    "      " + chalk.white("╱   ╲"),
    "",
  ],
  // [7] Back to standing
  [
    "",
    "",
    "    " + chalk.white("O"),
    "    " + chalk.white("│"),
    "   " + chalk.white("╱│╲"),
    "  " + chalk.white("╱   ╲"),
    "",
  ],
];

const FRAME_DELAYS = [280, 260, 400, 550, 800, 1000, 320, 220];

export async function matrixBulletDodge(): Promise<void> {
  // Digital rain intro
  const RAIN = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ0123456789";
  const W = Math.min(tw(), 70);

  process.stdout.write("\n");
  for (let row = 0; row < 5; row++) {
    let line = "  ";
    for (let col = 0; col < W; col++) {
      const ch = RAIN[Math.floor(Math.random() * RAIN.length)];
      const rng = Math.random();
      if (rng > 0.9) line += chalk.bold.white(ch);
      else if (rng > 0.6) line += chalk.green(ch);
      else line += chalk.dim.green(ch);
    }
    process.stdout.write(line + "\n");
    await sleep(70);
  }

  await sleep(300);
  process.stdout.write("\n");
  process.stdout.write(chalk.bold.green("  [ BULLET TIME ]\n\n"));
  await sleep(500);

  // Draw first frame
  const H = NEO_FRAMES[0].length;
  for (const line of NEO_FRAMES[0]) process.stdout.write("  " + line + "\n");

  // Animate remaining frames in-place
  for (let f = 1; f < NEO_FRAMES.length; f++) {
    await sleep(FRAME_DELAYS[f]);
    process.stdout.write(`\x1b[${H}A`);
    for (const line of NEO_FRAMES[f]) process.stdout.write("  " + line + "\n");
  }

  await sleep(600);
  process.stdout.write("\n");
  process.stdout.write(chalk.dim("  There is no spoon.\n\n"));
}

// ── /selfdestruct — dramatic countdown ───────────────────────────────────────

export async function selfDestructSequence(): Promise<void> {
  const W = Math.min(tw(), 52);
  const bar = (n: number) => {
    const filled = Math.round((n / 10) * W);
    return chalk.red("█".repeat(filled)) + chalk.dim("░".repeat(W - filled));
  };

  process.stdout.write("\n");
  process.stdout.write(chalk.red.bold("  ╔═══════════════════════════════════════════╗") + "\n");
  process.stdout.write(chalk.red.bold("  ║   SELF-DESTRUCT SEQUENCE  ·  AUTHORIZED   ║") + "\n");
  process.stdout.write(chalk.red.bold("  ╚═══════════════════════════════════════════╝") + "\n\n");
  await sleep(600);

  for (let i = 10; i >= 1; i--) {
    process.stdout.write(`  ${bar(i)}\n`);
    process.stdout.write(chalk.red.bold(`          ${String(i).padStart(2)} seconds remaining...\n`));
    await sleep(i > 5 ? 300 : 200);
    process.stdout.write("\x1b[2A");
  }

  process.stdout.write(`  ${bar(0)}\n`);
  process.stdout.write(chalk.red.bold("           DETONATING") + chalk.bold("...") + "\n");
  await sleep(700);

  process.stdout.write("\x1b[2A");
  process.stdout.write("  " + chalk.dim("─".repeat(W)) + "\n");
  process.stdout.write(chalk.green.bold("           OVERRIDE ACCEPTED  ·  ALL SYSTEMS NOMINAL\n"));
  await sleep(500);
  process.stdout.write("\n");
}
