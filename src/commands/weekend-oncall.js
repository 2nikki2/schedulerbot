import { SlashCommandBuilder } from "discord.js";
import { getUpcomingWeekendGroup } from "../engines/rotation.js";
import { getModByUserId, getAllMods } from "../db/database.js";
import { convertToLocal, now, isWeekend } from "../utils/time.js";
import { schedulerConfig } from "../config/scheduler.js";

export const data = new SlashCommandBuilder()
  .setName("weekend-oncall")
  .setDescription("View the upcoming weekend's on-call moderators");

export const adminOnly = false;

export async function execute(interaction) {
  const currentTime = now();
  const upcoming = getUpcomingWeekendGroup(currentTime);

  if (!upcoming) {
    return interaction.reply({
      content: "❌ Could not determine the upcoming weekend rotation.",
      ephemeral: true,
    });
  }

  // Determine requester's timezone for display
  const requesterMod = getModByUserId(interaction.user.id);
  const displayTz = requesterMod
    ? requesterMod.timezone
    : schedulerConfig.baseTimezone;

  // Build the roster display
  const saturday = upcoming.weekendSaturday;
  const sunday = upcoming.weekendSunday;
  const friday = saturday.minus({ days: 1 });

  const inWeekend = isWeekend(currentTime);
  const headerLabel = inWeekend ? "Current Weekend" : "Upcoming Weekend";

  // Format dates
  const dateRange = `${friday.toFormat("EEE LLL d")} – ${sunday.toFormat("EEE LLL d")}`;

  // Build shift lines with local time conversion
  const allMods = getAllMods();
  const modLookup = new Map(allMods.map((m) => [m.config_name.toUpperCase(), m]));

  let shiftLines = "";
  const seenMods = new Set();

  for (const shift of upcoming.shifts) {
    const modName = shift.mod.toUpperCase();
    const modData = modLookup.get(modName);
    const tz = modData ? modData.timezone : displayTz;

    // Convert shift times to the requester's timezone
    const startLocal = convertToLocal(shift.start, displayTz, saturday);
    const endLocal = convertToLocal(shift.end, displayTz, saturday);

    const userMention = modData ? `<@${modData.discord_user_id}>` : `**${shift.mod}**`;

    shiftLines += `• ${userMention} — ${startLocal} → ${endLocal}\n`;
  }

  const response = [
    `📅 **${headerLabel} On-Call (${dateRange})**`,
    `🔄 Rotation: **${upcoming.name}**`,
    ``,
    `**Schedule** _(times in ${displayTz})_:`,
    shiftLines.trim(),
  ].join("\n");

  return interaction.reply({
    content: response,
    ephemeral: true,
  });
}
