import Database from "better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "..", "data", "scheduler.db");

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for concurrent read/write safety (NFR10)
db.pragma("journal_mode = WAL");

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS mods (
    config_name TEXT PRIMARY KEY,
    discord_user_id TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ping_state (
    config_name TEXT PRIMARY KEY,
    last_ping_at TEXT,
    shift_started INTEGER DEFAULT 0,
    FOREIGN KEY (config_name) REFERENCES mods(config_name) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// --- Mod Registry (FR24) ---

const stmtUpsertMod = db.prepare(`
  INSERT INTO mods (config_name, discord_user_id, timezone)
  VALUES (?, ?, ?)
  ON CONFLICT(config_name) DO UPDATE SET
    discord_user_id = excluded.discord_user_id,
    timezone = excluded.timezone
`);

const stmtDeleteMod = db.prepare(`DELETE FROM mods WHERE config_name = ?`);
const stmtGetMod = db.prepare(`SELECT * FROM mods WHERE config_name = ?`);
const stmtGetModByUserId = db.prepare(`SELECT * FROM mods WHERE discord_user_id = ?`);
const stmtGetAllMods = db.prepare(`SELECT * FROM mods`);

export function registerMod(configName, discordUserId, timezone) {
  stmtUpsertMod.run(configName, discordUserId, timezone);
  // Initialize ping state for this mod
  db.prepare(`
    INSERT OR IGNORE INTO ping_state (config_name) VALUES (?)
  `).run(configName);
}

export function removeMod(configName) {
  stmtDeleteMod.run(configName);
}

export function getMod(configName) {
  return stmtGetMod.get(configName) || null;
}

export function getModByUserId(discordUserId) {
  return stmtGetModByUserId.get(discordUserId) || null;
}

export function getAllMods() {
  return stmtGetAllMods.all();
}

// --- Ping State (FR25) ---

const stmtGetPingState = db.prepare(`SELECT * FROM ping_state WHERE config_name = ?`);
const stmtUpdatePingTime = db.prepare(`
  UPDATE ping_state SET last_ping_at = ? WHERE config_name = ?
`);
const stmtUpdateShiftStarted = db.prepare(`
  UPDATE ping_state SET shift_started = ? WHERE config_name = ?
`);
const stmtResetPingState = db.prepare(`
  UPDATE ping_state SET last_ping_at = NULL, shift_started = 0 WHERE config_name = ?
`);
const stmtGetAllPingStates = db.prepare(`SELECT * FROM ping_state`);

export function getPingState(configName) {
  return stmtGetPingState.get(configName) || null;
}

export function getAllPingStates() {
  return stmtGetAllPingStates.all();
}

export function updateLastPingTime(configName, isoTimestamp) {
  stmtUpdatePingTime.run(isoTimestamp, configName);
}

export function setShiftStarted(configName, started) {
  stmtUpdateShiftStarted.run(started ? 1 : 0, configName);
}

export function resetPingState(configName) {
  stmtResetPingState.run(configName);
}

// --- Settings (FR26) ---

const stmtGetSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`);
const stmtSetSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

export function getSetting(key) {
  const row = stmtGetSetting.get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  stmtSetSetting.run(key, value);
}

// Convenience: ping channel
export function getPingChannelId() {
  return getSetting("ping_channel_id");
}

export function setPingChannelId(channelId) {
  setSetting("ping_channel_id", channelId);
}

// --- Cleanup ---

export function closeDatabase() {
  db.close();
}

export default db;
