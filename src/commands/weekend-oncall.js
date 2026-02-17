import { SlashCommandBuilder } from "discord.js";
import { getUpcomingWeekendGroup } from "../engines/rotation.js";
import { getAllMods } from "../db/database.js";
import { now, isWeekend, toDiscordTs } from "../utils/time.js";

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

  // Build the roster display
  const saturday = upcoming.weekendSaturday;
  const sunday = upcoming.weekendSunday;
  const friday = saturday.minus({ days: 1 });

  const inWeekend = isWeekend(currentTime);
  const headerLabel = inWeekend ? "Current Weekend" : "Upcoming Weekend";

  // Format dates
  const dateRange = `${friday.toFormat("EEE LLL d")} – ${sunday.toFormat("EEE LLL d")}`;

  // Lookup registered mods
  const allMods = getAllMods();
  const modLookup = new Map(allMods.map((m) => [m.config_name.toUpperCase(), m]));

  // Helper: get @mention or bold name
  const mention = (modName) => {
    const d = modLookup.get(modName.toUpperCase());
    return d ? `<@${d.discord_user_id}>` : `**${modName}**`;
  };

  // Identify night mod and day mod from the shift definitions
  // Night shift crosses midnight (start > end, e.g. 19:00→07:00)
  let nightMod = null;
  let dayMod = null;
  for (const shift of upcoming.shifts) {
    const [sH] = shift.start.split(":").map(Number);
    const [eH] = shift.end.split(":").map(Number);
    if (eH <= sH && shift.end !== "24:00") {
      nightMod = shift.mod;
    } else {
      dayMod = shift.mod;
    }
  }

  // Build the full weekend timeline with actual DateTimes for timezone conversion
  // Fri 22:00 → Sat 07:00 (night)
  // Sat 07:00 → Sat 19:00 (day)
  // Sat 19:00 → Sun 07:00 (night)
  // Sun 07:00 → Sun 19:00 (day)
  // Sun 19:00 → Sun 22:00 (night)
  const timeline = [
    { label: "Fri night", mod: nightMod, start: friday.set({ hour: 22, minute: 0 }), end: saturday.set({ hour: 7, minute: 0 }) },
    { label: "Sat day",   mod: dayMod,   start: saturday.set({ hour: 7, minute: 0 }), end: saturday.set({ hour: 19, minute: 0 }) },
    { label: "Sat night", mod: nightMod, start: saturday.set({ hour: 19, minute: 0 }), end: sunday.set({ hour: 7, minute: 0 }) },
    { label: "Sun day",   mod: dayMod,   start: sunday.set({ hour: 7, minute: 0 }), end: sunday.set({ hour: 19, minute: 0 }) },
    { label: "Sun eve",   mod: nightMod, start: sunday.set({ hour: 19, minute: 0 }), end: sunday.set({ hour: 22, minute: 0 }) },
  ];

  // Format each timeline entry using Discord timestamps (auto local time)
  const shiftLines = timeline
    .map((t) => `• ${mention(t.mod)} — ${toDiscordTs(t.start, "f")} → ${toDiscordTs(t.end, "t")}`)
    .join("\n");

  const response = [
    `📅 **${headerLabel} On-Call (${dateRange})**`,
    `🔄 Rotation: **${upcoming.name}**`,
    ``,
    `**Schedule:**`,
    shiftLines,
  ].join("\n");

  return interaction.reply({
    content: response,
    ephemeral: true,
  });
}
