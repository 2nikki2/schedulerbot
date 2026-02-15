import { SlashCommandBuilder } from "discord.js";
import { getModByUserId } from "../db/database.js";
import { getModSchedule } from "../engines/schedule.js";
import { convertToLocal, now } from "../utils/time.js";
import { getUpcomingWeekendGroup } from "../engines/rotation.js";

export const data = new SlashCommandBuilder()
  .setName("my-shifts")
  .setDescription("View your upcoming shift schedule in your local timezone");

export const adminOnly = false;

export async function execute(interaction) {
  const mod = getModByUserId(interaction.user.id);

  if (!mod) {
    return interaction.reply({
      content:
        "❌ You're not registered as a moderator. Ask an admin to register you with `/register-mod`.",
      ephemeral: true,
    });
  }

  const schedule = getModSchedule(mod.config_name);
  const currentTime = now();
  const tz = mod.timezone;

  // Build weekday schedule
  let weekdayLines = "";
  if (schedule.weekday.length === 0) {
    weekdayLines = "_No weekday shifts assigned._";
  } else {
    for (const shift of schedule.weekday) {
      const startLocal = convertToLocal(shift.start, tz, currentTime);
      const endLocal = convertToLocal(shift.end, tz, currentTime);
      weekdayLines += `• ${startLocal} → ${endLocal}\n`;
    }
  }

  // Build weekend schedule
  let weekendLines = "";
  if (schedule.weekend.length === 0) {
    weekendLines = "_No weekend shifts assigned._";
  } else {
    for (const entry of schedule.weekend) {
      weekendLines += `**${entry.groupName}:**\n`;
      for (const shift of entry.shifts) {
        const startLocal = convertToLocal(shift.start, tz, currentTime);
        const endLocal = convertToLocal(shift.end, tz, currentTime);
        weekendLines += `  • ${startLocal} → ${endLocal}\n`;
      }
    }
  }

  // Determine upcoming weekend rotation for this mod
  const upcoming = getUpcomingWeekendGroup(currentTime);
  const isOnCallThisWeekend = upcoming.shifts.some(
    (s) => s.mod.toUpperCase() === mod.config_name.toUpperCase()
  );

  const weekendStatus = isOnCallThisWeekend
    ? `✅ **You ARE on-call this weekend** (${upcoming.name})`
    : `💤 **You are NOT on-call this weekend** (${upcoming.name} is active)`;

  const response = [
    `📋 **Schedule for ${mod.config_name}** _(times in ${tz})_`,
    ``,
    `**Weekday Shifts (Sun 19:00 → Fri 19:00):**`,
    weekdayLines.trim(),
    ``,
    `**Weekend Rotation Shifts:**`,
    weekendLines.trim(),
    ``,
    weekendStatus,
  ].join("\n");

  return interaction.reply({
    content: response,
    ephemeral: true,
  });
}
