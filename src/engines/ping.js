import { DateTime } from "luxon";
import { schedulerConfig } from "../config/scheduler.js";
import { getActiveShifts } from "./schedule.js";
import { getUpcomingWeekendGroup } from "./rotation.js";
import {
  now,
  isWeekend,
  getPingIntervalMinutes,
  getShiftEndDt,
  toDiscordTs,
  timeStrToDateTime,
} from "../utils/time.js";
import {
  getAllMods,
  getMod,
  getPingState,
  getAllPingStates,
  updateLastPingTime,
  setShiftStarted,
  resetPingState,
  getPingChannelId,
  getSetting,
  setSetting,
} from "../db/database.js";

const TICK_INTERVAL_MS = 60_000; // 60 seconds

let tickInterval = null;
let discordClient = null;

/**
 * Ping Engine (FR10–FR15)
 *
 * 60-second tick loop that evaluates all registered mods' shift eligibility
 * and dispatches ephemeral pings in the configured channel.
 */

/**
 * Start the ping engine tick loop.
 * @param {import('discord.js').Client} client - Discord.js client
 */
export function startPingEngine(client) {
  discordClient = client;
  console.log("[PingEngine] Starting tick loop (60s interval)");

  // Run immediately, then every 60 seconds
  tick();
  tickInterval = setInterval(tick, TICK_INTERVAL_MS);
}

/**
 * Stop the ping engine.
 */
export function stopPingEngine() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    console.log("[PingEngine] Tick loop stopped");
  }
}

/**
 * Single tick — evaluate all mods and send pings as needed.
 * Must complete within 200ms (NFR1).
 */
async function tick() {
  const tickStart = performance.now();

  try {
    const currentTime = now();
    const channelId = getPingChannelId();

    if (!channelId) {
      // No channel configured — skip silently
      return;
    }

    const mods = getAllMods();
    if (mods.length === 0) return;

    const activeShifts = getActiveShifts(currentTime);

    // Build a set of mod names currently on shift
    const onShiftMods = new Map();
    for (const shift of activeShifts) {
      // A mod may have multiple active shifts (split shifts) — use the first one found
      if (!onShiftMods.has(shift.mod.toUpperCase())) {
        onShiftMods.set(shift.mod.toUpperCase(), shift);
      }
    }

    // Evaluate each registered mod
    for (const mod of mods) {
      const configName = mod.config_name.toUpperCase();
      const shift = onShiftMods.get(configName);
      const pingState = getPingState(mod.config_name);

      if (shift) {
        // Mod IS on shift
        await handleOnShiftMod(mod, shift, pingState, currentTime, channelId);
      } else {
        // Mod is NOT on shift — reset their state if needed
        if (pingState && (pingState.shift_started || pingState.last_ping_at)) {
          resetPingState(mod.config_name);
        }
      }
    }

    // Monday/Wednesday weekend on-call heads-up
    await weekendHeadsUp(currentTime, channelId);
  } catch (err) {
    console.error("[PingEngine] Tick error:", err);
  } finally {
    const elapsed = performance.now() - tickStart;
    if (elapsed > 200) {
      console.warn(`[PingEngine] Tick exceeded 200ms: ${elapsed.toFixed(1)}ms`);
    }
  }
}

/**
 * Handle a mod who is currently on shift.
 * Sends shift-start notification (FR11) and periodic reminders (FR12).
 * Routes to DM or channel mention based on mod's notify_preference.
 *
 * @param {object} mod - Mod from DB { config_name, discord_user_id, timezone, notify_preference }
 * @param {object} shift - Active shift { mod, start, end, isWeekendShift }
 * @param {object} pingState - DB state { config_name, last_ping_at, shift_started }
 * @param {DateTime} currentTime
 * @param {string} channelId
 */
async function handleOnShiftMod(mod, shift, pingState, currentTime, channelId) {
  const preference = mod.notify_preference || "dm";

  // Opted out — no notifications at all
  if (preference === "none") return;

  // FR11: Shift-start notification
  if (!pingState || !pingState.shift_started) {
    const endTs = toDiscordTs(getShiftEndDt(shift, currentTime), "t");

    await sendPing(
      channelId,
      mod.discord_user_id,
      mod.config_name,
      preference,
      `🔔 **Your shift starts now!** You're on duty until ${endTs}.`,
      true // isShiftStart — allow channel fallback if DM fails
    );

    setShiftStarted(mod.config_name, true);
    updateLastPingTime(mod.config_name, currentTime.toISO());
    return; // Don't also send a periodic ping on the same tick
  }

  // FR12: Periodic reminders — only for DM users (channel users get shift-start only)
  if (preference !== "dm") return;

  const intervalMinutes = shift.isWeekendShift
    ? schedulerConfig.pingIntervals.weekendMinutes
    : schedulerConfig.pingIntervals.weekdayMinutes;

  if (pingState.last_ping_at) {
    const lastPing = DateTime.fromISO(pingState.last_ping_at);
    const minutesSinceLastPing = currentTime.diff(lastPing, "minutes").minutes;

    if (minutesSinceLastPing >= intervalMinutes) {
      const endTs = toDiscordTs(getShiftEndDt(shift, currentTime), "t");

      await sendPing(
        channelId,
        mod.discord_user_id,
        mod.config_name,
        preference,
        `⏰ **Shift reminder** — you're on duty until ${endTs}.`
      );

      updateLastPingTime(mod.config_name, currentTime.toISO());
    }
  }
}

/**
 * Send a notification to a mod based on their notify_preference ('dm' | 'channel').
 * Also sends an admin copy to the scheduler channel for visibility.
 *
 * @param {string} channelId - The configured scheduler channel
 * @param {string} userId - Mod's Discord user ID
 * @param {string} configName - Mod's config name (e.g. QUEEN)
 * @param {string} preference - 'dm' or 'channel'
 * @param {string} message - The notification text
 */
/**
 * @param {boolean} isShiftStart - If true, DM failures fall back to channel. If false, skip silently.
 */
async function sendPing(channelId, userId, configName, preference, message, isShiftStart = false) {
  if (!discordClient) return;

  const channel = await discordClient.channels.fetch(channelId).catch(() => null);

  if (preference === "dm") {
    // --- DM mode ---
    try {
      const user = await discordClient.users.fetch(userId);
      if (user) {
        await user.send(message);
      }
    } catch (err) {
      // Only fall back to channel for shift-start notifications
      if (isShiftStart && channel) {
        await channel.send(`<@${userId}> ${message}`).catch((e) =>
          console.error(`[PingEngine] Fallback channel ping failed for ${configName}:`, e.message)
        );
      } else {
        console.warn(`[PingEngine] DM failed for ${configName}, skipping periodic reminder`);
      }
    }
  } else {
    // --- Channel mention mode (shift-start only, enforced by caller) ---
    if (channel) {
      await channel.send(`<@${userId}> ${message}`).catch((e) =>
        console.error(`[PingEngine] Channel ping failed for ${configName}:`, e.message)
      );
    }
  }
}


/**
 * Send a "Weekend On-Call Heads Up" reminder on Monday and Wednesday at 10:00 AM CST.
 * Uses a DB setting to ensure it only fires once per day.
 *
 * @param {DateTime} currentTime - Current time in base timezone
 * @param {string} channelId - Scheduler channel ID
 */
async function weekendHeadsUp(currentTime, channelId) {
  const dayOfWeek = currentTime.weekday; // 1=Mon, 3=Wed
  const hour = currentTime.hour;
  const minute = currentTime.minute;

  // Only fire on Monday (1) or Wednesday (3) during the 10:00 AM window
  if (dayOfWeek !== 1 && dayOfWeek !== 3) return;
  if (hour !== 10 || minute > 0) return;

  // Check if we already sent today
  const todayKey = currentTime.toISODate(); // e.g. "2026-02-16"
  const lastSent = getSetting("last_headsup_date");
  if (lastSent === todayKey) return;

  // Mark as sent immediately to prevent duplicates
  setSetting("last_headsup_date", todayKey);

  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  try {
    const upcoming = getUpcomingWeekendGroup(currentTime);
    const satDate = upcoming.weekendSaturday.toFormat("LLL d");
    const sunDate = upcoming.weekendSunday.toFormat("LLL d");

    // Build shift lines using Discord timestamps (auto local time for every reader)
    const shiftLines = [];
    for (const shift of upcoming.shifts) {
      const modData = getMod(shift.mod.toUpperCase());
      const modMention = modData ? `<@${modData.discord_user_id}>` : `**${shift.mod}**`;

      const startDt = timeStrToDateTime(shift.start, upcoming.weekendSaturday);
      const endDt = timeStrToDateTime(shift.end, upcoming.weekendSaturday);

      shiftLines.push(`• ${modMention} (**${shift.mod}**) — ${toDiscordTs(startDt, "t")} → ${toDiscordTs(endDt, "t")}`);
    }

    const dayLabel = dayOfWeek === 1 ? "Monday" : "Wednesday";

    await channel.send(
      `📅 **Weekend On-Call Heads Up!** *(${dayLabel} reminder)*\n` +
      `This weekend is **${upcoming.name}** (${satDate}–${sunDate})\n\n` +
      `🕐 **Shifts:**\n` +
      shiftLines.join("\n")
    );

    console.log(`[PingEngine] Sent ${dayLabel} weekend heads-up for ${upcoming.name}`);
  } catch (err) {
    console.error("[PingEngine] Weekend heads-up failed:", err.message);
  }
}
