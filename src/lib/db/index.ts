import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

// Database file location - use DATA_DIR env var or default to project root
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DB_PATH = path.join(DATA_DIR, "data", "prompt-library.db");

// Create database connection
// Using a singleton pattern for the database connection
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (!_db) {
    // Ensure data directory exists
    const fs = require("fs");
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create SQLite connection
    _sqlite = new Database(DB_PATH);
    
    // Enable WAL mode for better concurrent performance
    _sqlite.pragma("journal_mode = WAL");
    
    // Enable foreign keys
    _sqlite.pragma("foreign_keys = ON");
    
    // Create Drizzle instance
    _db = drizzle(_sqlite, { schema });
    
    // Initialize FTS if needed
    initializeFts(_sqlite);
  }
  
  return _db;
}

// Get raw SQLite connection for FTS operations
export function getSqlite(): Database.Database {
  if (!_sqlite) {
    getDb(); // This will initialize _sqlite
  }
  return _sqlite!;
}

// Initialize FTS5 virtual table and triggers
function initializeFts(sqlite: Database.Database) {
  // Create FTS5 virtual table for full-text search
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
      title,
      description,
      system_template,
      user_template,
      tags,
      content='prompts',
      content_rowid='rowid'
    );
  `);

  // Create triggers to keep FTS in sync
  // Note: SQLite doesn't have ROWID for tables with text primary keys,
  // so we need to use a different approach

  // First, check if prompts table exists and has data
  const tableExists = sqlite.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='prompts'
  `).get();

  if (tableExists) {
    // Create triggers for FTS sync
    sqlite.exec(`
      -- Trigger for INSERT
      CREATE TRIGGER IF NOT EXISTS prompts_ai AFTER INSERT ON prompts BEGIN
        INSERT INTO prompts_fts(rowid, title, description, system_template, user_template, tags)
        VALUES (NEW.rowid, NEW.title, NEW.description, NEW.system_template, NEW.user_template, 
                CASE WHEN NEW.tags IS NOT NULL THEN NEW.tags ELSE '[]' END);
      END;

      -- Trigger for DELETE
      CREATE TRIGGER IF NOT EXISTS prompts_ad AFTER DELETE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, title, description, system_template, user_template, tags)
        VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.system_template, OLD.user_template,
                CASE WHEN OLD.tags IS NOT NULL THEN OLD.tags ELSE '[]' END);
      END;

      -- Trigger for UPDATE
      CREATE TRIGGER IF NOT EXISTS prompts_au AFTER UPDATE ON prompts BEGIN
        INSERT INTO prompts_fts(prompts_fts, rowid, title, description, system_template, user_template, tags)
        VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.system_template, OLD.user_template,
                CASE WHEN OLD.tags IS NOT NULL THEN OLD.tags ELSE '[]' END);
        INSERT INTO prompts_fts(rowid, title, description, system_template, user_template, tags)
        VALUES (NEW.rowid, NEW.title, NEW.description, NEW.system_template, NEW.user_template,
                CASE WHEN NEW.tags IS NOT NULL THEN NEW.tags ELSE '[]' END);
      END;
    `);
  }
}

// Rebuild FTS index (useful after bulk imports)
export function rebuildFtsIndex() {
  const sqlite = getSqlite();
  
  // Delete all FTS content
  sqlite.exec(`DELETE FROM prompts_fts;`);
  
  // Rebuild from prompts table
  sqlite.exec(`
    INSERT INTO prompts_fts(rowid, title, description, system_template, user_template, tags)
    SELECT rowid, title, description, system_template, user_template, 
           CASE WHEN tags IS NOT NULL THEN tags ELSE '[]' END
    FROM prompts;
  `);
}

// Export schema and types
export * from "./schema";
