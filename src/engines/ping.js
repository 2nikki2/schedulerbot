import { DateTime } from "luxon";
import { schedulerConfig } from "../config/scheduler.js";
import { getActiveShifts } from "./schedule.js";
import {
  now,
  isWeekend,
  getPingIntervalMinutes,
  getShiftEndLocal,
} from "../utils/time.js";
import {
  getAllMods,
  getPingState,
  getAllPingStates,
  updateLastPingTime,
  setShiftStarted,
  resetPingState,
  getPingChannelId,
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
 *
 * @param {object} mod - Mod from DB { config_name, discord_user_id, timezone }
 * @param {object} shift - Active shift { mod, start, end, isWeekendShift }
 * @param {object} pingState - DB state { config_name, last_ping_at, shift_started }
 * @param {DateTime} currentTime
 * @param {string} channelId
 */
async function handleOnShiftMod(mod, shift, pingState, currentTime, channelId) {
  // FR11: Shift-start notification
  if (!pingState || !pingState.shift_started) {
    const endTimeLocal = getShiftEndLocal(shift, mod.timezone, currentTime);

    await sendEphemeralPing(
      channelId,
      mod.discord_user_id,
      `🔔 **Your shift starts now!** You're on duty until **${endTimeLocal}**.`
    );

    setShiftStarted(mod.config_name, true);
    updateLastPingTime(mod.config_name, currentTime.toISO());
    return; // Don't also send a periodic ping on the same tick
  }

  // FR12: Periodic reminders at configured intervals
  const intervalMinutes = shift.isWeekendShift
    ? schedulerConfig.pingIntervals.weekendMinutes
    : schedulerConfig.pingIntervals.weekdayMinutes;

  if (pingState.last_ping_at) {
    const lastPing = DateTime.fromISO(pingState.last_ping_at);
    const minutesSinceLastPing = currentTime.diff(lastPing, "minutes").minutes;

    if (minutesSinceLastPing >= intervalMinutes) {
      const endTimeLocal = getShiftEndLocal(shift, mod.timezone, currentTime);

      await sendEphemeralPing(
        channelId,
        mod.discord_user_id,
        `⏰ **Shift reminder** — you're on duty until **${endTimeLocal}**.`
      );

      updateLastPingTime(mod.config_name, currentTime.toISO());
    }
  }
}

/**
 * Send an ephemeral-like message to a specific user in the ping channel.
 *
 * Note: True ephemeral messages require an interaction (slash command).
 * For proactive pings, we send a DM or a mention that auto-deletes.
 * Best approach: send a DM to the user from the bot.
 *
 * @param {string} channelId
 * @param {string} userId
 * @param {string} message
 */
async function sendEphemeralPing(channelId, userId, message) {
  if (!discordClient) return;

  try {
    // Send as DM for true privacy (ephemeral-like behavior)
    const user = await discordClient.users.fetch(userId);
    if (user) {
      await user.send(message);
    }
  } catch (err) {
    // Fallback: try sending in channel with user mention
    // (user may have DMs disabled)
    try {
      const channel = await discordClient.channels.fetch(channelId);
      if (channel) {
        const msg = await channel.send(`<@${userId}> ${message}`);
        // Auto-delete after 30 seconds to reduce noise
        setTimeout(() => {
          msg.delete().catch(() => {});
        }, 30_000);
      }
    } catch (fallbackErr) {
      console.error(
        `[PingEngine] Failed to ping ${userId}:`,
        fallbackErr.message
      );
    }
  }
}
