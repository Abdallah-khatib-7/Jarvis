import db from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS token_usage (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    tokens     INTEGER NOT NULL,
    model      TEXT    NOT NULL,
    date       TEXT    NOT NULL DEFAULT (date('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export const DAILY_LIMIT = 75_000;
export const WARN_AT = 0.90;

export function addTokens(userId: number, tokens: number, model: string): void {
  if (tokens <= 0) return;
  db.prepare(
    "INSERT INTO token_usage (user_id, tokens, model) VALUES (?, ?, ?)"
  ).run(userId, tokens, model);
}

export function getDailyTokens(userId: number): number {
  const row = db
    .prepare(
      "SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage WHERE user_id = ? AND date = date('now')"
    )
    .get(userId) as { total: number };
  return row.total;
}

export function getTimeUntilReset(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight.getTime() - now.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}
