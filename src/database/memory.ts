import db from "./db.js";

/* key/value facts per user; one row per (user, key), newest value wins */
db.exec(`
  CREATE TABLE IF NOT EXISTS memory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    key        TEXT    NOT NULL,
    value      TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

export interface MemoryFact {
  key: string;
  value: string;
}

/* upsert: set the fact, overwrite if that key already exists for the user */
export function setFact(userId: number, key: string, value: string): void {
  db.prepare(
    `INSERT INTO memory (user_id, key, value)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`
  ).run(userId, key, value);
}

export function getFact(userId: number, key: string): string | undefined {
  const row = db
    .prepare("SELECT value FROM memory WHERE user_id = ? AND key = ?")
    .get(userId, key) as { value: string } | undefined;
  return row?.value;
}

/* all facts for a user; this is what later gets fed into JARVIS's context */
export function getAllFacts(userId: number): MemoryFact[] {
  return db
    .prepare("SELECT key, value FROM memory WHERE user_id = ? ORDER BY key")
    .all(userId) as MemoryFact[];
}

export function deleteFact(userId: number, key: string): boolean {
  const result = db
    .prepare("DELETE FROM memory WHERE user_id = ? AND key = ?")
    .run(userId, key);
  return result.changes > 0;
}