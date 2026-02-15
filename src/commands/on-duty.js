import { SlashCommandBuilder } from "discord.js";
import { getActiveShifts } from "../engines/schedule.js";
import { getAllMods } from "../db/database.js";
import { now, isWeekend, convertToLocal, getShiftEndLocal } from "../utils/time.js";
import { schedulerConfig } from "../config/scheduler.js";
import { getActiveWeekendGroup } from "../engines/rotation.js";

export const data = new SlashCommandBuilder()
  .setName("on-duty")
  .setDescription("View which moderators are currently on shift");

export const adminOnly = false;

export async function execute(interaction) {
  const currentTime = now();
  const activeShifts = getActiveShifts(currentTime);
  const weekend = isWeekend(currentTime);

  if (activeShifts.length === 0) {
    return interaction.reply({
      content: "🔇 No moderators are currently on shift.",
      ephemeral: true,
    });
  }

  // Get all registered mods for display
  const allMods = getAllMods();
  const modLookup = new Map(
    allMods.map((m) => [m.config_name.toUpperCase(), m])
  );

  // Determine display timezone (use requester's if registered, else base)
  const requesterMod = allMods.find(
    (m) => m.discord_user_id === interaction.user.id
  );
  const displayTz = requesterMod
    ? requesterMod.timezone
    : schedulerConfig.baseTimezone;

  let lines = "";
  for (const shift of activeShifts) {
    const modData = modLookup.get(shift.mod.toUpperCase());
    const userDisplay = modData
      ? `<@${modData.discord_user_id}>`
      : `**${shift.mod}**`;
    const endLocal = getShiftEndLocal(shift, displayTz, currentTime);
    lines += `• ${userDisplay} — until ${endLocal}\n`;
  }

  const scheduleType = weekend ? "🗓️ Weekend Rotation" : "📅 Weekday Schedule";
  let rotationInfo = "";
  if (weekend) {
    const group = getActiveWeekendGroup(currentTime);
    rotationInfo = ` (${group.name})`;
  }

  const response = [
    `🟢 **Currently On Duty** — ${scheduleType}${rotationInfo}`,
    `_(times in ${displayTz})_`,
    ``,
    lines.trim(),
  ].join("\n");

  return interaction.reply({
    content: response,
    ephemeral: true,
  });
}
