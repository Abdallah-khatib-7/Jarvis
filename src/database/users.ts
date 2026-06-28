import bcrypt from "bcrypt";
import db from "./db.js";

/* the shape we store; password_hash never leaves this layer in raw form */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

const SALT_ROUNDS = 12;

export function userExists(username: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM users WHERE username = ?")
    .get(username);
  return row !== undefined;
}

export function getUser(username: string): User | undefined {
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as User | undefined;
}

/* hashes before insert; returns the created user's id */
export function createUser(username: string, password: string): number {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const result = db
    .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(username, hash);
  return result.lastInsertRowid as number;
}

/* compares a plaintext attempt against the stored hash */
export function verifyUser(username: string, password: string): boolean {
  const user = getUser(username);
  if (!user) return false;
  return bcrypt.compareSync(password, user.password_hash);
}