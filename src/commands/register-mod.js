import { SlashCommandBuilder } from "discord.js";
import { registerMod } from "../db/database.js";
import { isValidTimezone } from "../utils/time.js";
import { schedulerConfig } from "../config/scheduler.js";

// Collect all valid config names from the schedule
const validConfigNames = new Set();
for (const shift of schedulerConfig.weekdayShifts) {
  validConfigNames.add(shift.mod.toUpperCase());
}
for (const group of schedulerConfig.weekendRotation.weekends) {
  for (const shift of group.shifts) {
    validConfigNames.add(shift.mod.toUpperCase());
  }
}

export const data = new SlashCommandBuilder()
  .setName("register-mod")
  .setDescription("Register a Discord user as a moderator (Admin only)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The Discord user").setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("name")
      .setDescription("Config name (e.g., QUEEN, ED, HAAX)")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("timezone")
      .setDescription("IANA timezone (e.g., America/New_York)")
      .setRequired(true)
  );

export const adminOnly = true;

export async function execute(interaction) {
  const user = interaction.options.getUser("user");
  const name = interaction.options.getString("name").toUpperCase();
  const timezone = interaction.options.getString("timezone");

  // Validate config name exists in schedule
  if (!validConfigNames.has(name)) {
    return interaction.reply({
      content: `❌ **"${name}"** is not a valid config name. Valid names: ${[...validConfigNames].join(", ")}`,
      ephemeral: true,
    });
  }

  // Validate timezone (NFR8)
  if (!isValidTimezone(timezone)) {
    return interaction.reply({
      content: `❌ **"${timezone}"** is not a valid IANA timezone. Examples: \`America/New_York\`, \`Europe/London\`, \`Asia/Tokyo\``,
      ephemeral: true,
    });
  }

  // Register in database (FR16, FR24)
  registerMod(name, user.id, timezone);

  return interaction.reply({
    content: `✅ Registered **${user.username}** as **${name}** (timezone: \`${timezone}\`)`,
    ephemeral: true,
  });
}
