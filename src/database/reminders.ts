import db from "./db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    message    TEXT    NOT NULL,
    fire_at    TEXT    NOT NULL,
    delivery   TEXT    NOT NULL,
    gmail_to   TEXT,
    fired      INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export interface ReminderRow {
  id: number;
  user_id: number;
  message: string;
  fire_at: string;
  delivery: string;
  gmail_to: string | null;
  fired: number;
}

export function insertReminder(
  userId: number,
  message: string,
  fireAt: Date,
  delivery: string,
  gmailTo: string | null
): number {
  const result = db
    .prepare(
      `INSERT INTO reminders (user_id, message, fire_at, delivery, gmail_to)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, message, fireAt.toISOString(), delivery, gmailTo ?? null);
  return result.lastInsertRowid as number;
}

export function markFired(id: number): void {
  db.prepare("UPDATE reminders SET fired = 1 WHERE id = ?").run(id);
}

export function deleteReminder(id: number, userId: number): boolean {
  const result = db
    .prepare("DELETE FROM reminders WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return result.changes > 0;
}

export function getPendingReminders(userId: number): ReminderRow[] {
  return db
    .prepare(
      `SELECT * FROM reminders WHERE user_id = ? AND fired = 0 ORDER BY fire_at ASC`
    )
    .all(userId) as ReminderRow[];
}

export function getReminderById(id: number, userId: number): ReminderRow | undefined {
  return db
    .prepare(`SELECT * FROM reminders WHERE id = ? AND user_id = ? AND fired = 0`)
    .get(id, userId) as ReminderRow | undefined;
}
