import chalk from "chalk";
import keytar from "keytar";
import si from "systeminformation";

const SERVICE = "jarvis";

const CPU_THRESHOLD = 85;   // %
const RAM_THRESHOLD = 90;   // %
const DISK_MIN_FREE = 0.10; // 10% free
const CHECK_INTERVAL = 60_000;        // every 60s
const ALERT_COOLDOWN = 10 * 60_000;  // re-alert same issue max once per 10 min
const CPU_STREAK_REQUIRED = 2;        // consecutive high readings before alerting

const lastAlerted: Record<string, number> = {};
let cpuHighStreak = 0;

// ── helpers ───────────────────────────────────────────────────────────────────

function W(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${b} B`;
}

function canAlert(key: string): boolean {
  const last = lastAlerted[key] ?? 0;
  if (Date.now() - last > ALERT_COOLDOWN) {
    lastAlerted[key] = Date.now();
    return true;
  }
  return false;
}

function showAlert(title: string, lines: string[]): void {
  const w = W();
  const tag = ` ⚡ ${title} `;
  const fill = "─".repeat(Math.max(0, w - 2 - tag.length));
  process.stdout.write("\n\x07"); // bell
  process.stdout.write(chalk.red(`╭─${tag}${fill}`) + "\n");
  for (const line of lines) {
    process.stdout.write(chalk.red("│") + "  " + chalk.white(line) + "\n");
  }
  process.stdout.write(chalk.red(`╰${"─".repeat(w - 1)}`) + "\n\n");
}

async function sendTelegram(userId: number, message: string): Promise<void> {
  try {
    const stored = await keytar.getPassword(SERVICE, `telegram-${userId}`);
    if (!stored) return;
    const { token, chatId } = JSON.parse(stored) as { token: string; chatId: string };
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // silent — never let a Telegram failure affect JARVIS
  }
}

// ── check cycle ───────────────────────────────────────────────────────────────

async function runCheck(userId: number): Promise<void> {
  try {
    const [load, mem, fs] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);

    const cpuPct = Math.round(load.currentLoad);
    const ramPct = Math.round((mem.active / mem.total) * 100);

    // ── CPU ──────────────────────────────────────────────────────────────────
    if (cpuPct > CPU_THRESHOLD) {
      cpuHighStreak++;
      if (cpuHighStreak >= CPU_STREAK_REQUIRED && canAlert("cpu")) {
        showAlert("SYSTEM ALERT — HIGH CPU", [
          `CPU usage is at ${cpuPct}%  (threshold: ${CPU_THRESHOLD}%)`,
          `High load sustained for ${cpuHighStreak} minutes — something is running hot.`,
        ]);
        await sendTelegram(
          userId,
          `<b>⚡ JARVIS System Alert</b>\n\n🔥 CPU at <b>${cpuPct}%</b>\nSustained high load detected. Check running processes.`
        );
      }
    } else {
      cpuHighStreak = 0;
    }

    // ── RAM ──────────────────────────────────────────────────────────────────
    if (ramPct > RAM_THRESHOLD && canAlert("ram")) {
      showAlert("SYSTEM ALERT — HIGH MEMORY", [
        `RAM: ${fmtBytes(mem.active)} used / ${fmtBytes(mem.total)} total  (${ramPct}%)`,
        `Only ${fmtBytes(mem.free)} free. Consider closing applications.`,
      ]);
      await sendTelegram(
        userId,
        `<b>💾 JARVIS System Alert</b>\n\n🧠 RAM at <b>${ramPct}%</b>\n${fmtBytes(mem.active)} / ${fmtBytes(mem.total)} used.`
      );
    }

    // ── Disk ─────────────────────────────────────────────────────────────────
    for (const drive of fs.filter((d) => d.size > 1_000_000_000)) {
      const freePct = drive.available / drive.size;
      if (freePct < DISK_MIN_FREE) {
        const key = `disk-${drive.mount || drive.fs}`;
        if (canAlert(key)) {
          const label = drive.mount || drive.fs;
          const freeLabel = fmtBytes(drive.available);
          const totalLabel = fmtBytes(drive.size);
          const pctFree = Math.round(freePct * 100);
          showAlert("SYSTEM ALERT — LOW DISK SPACE", [
            `Drive ${label}: only ${freeLabel} free of ${totalLabel}  (${pctFree}% remaining)`,
            "Consider cleaning up files or expanding storage.",
          ]);
          await sendTelegram(
            userId,
            `<b>💿 JARVIS System Alert</b>\n\nDisk <code>${label}</code> is almost full.\n${freeLabel} free of ${totalLabel} (${pctFree}% remaining).`
          );
        }
      }
    }
  } catch {
    // never crash JARVIS from a watchdog error
  }
}

// ── public API ────────────────────────────────────────────────────────────────

export function startWatchdog(session: { id: number }): void {
  setInterval(() => void runCheck(session.id), CHECK_INTERVAL);
}
