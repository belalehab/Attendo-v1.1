import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';

const dbPath = path.join(app.getPath('userData'), 'attendo_core.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    national_id TEXT UNIQUE,
    grade TEXT, -- 🚀 NEW: Store the student's grade/year
    status TEXT DEFAULT 'offline'
  )
`);

console.log('✅ SQLite Database initialized at:', dbPath);

export default db;