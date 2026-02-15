import { SlashCommandBuilder } from "discord.js";
import { removeMod, getMod } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("remove-mod")
  .setDescription("Remove a moderator from the schedule (Admin only)")
  .addStringOption((opt) =>
    opt
      .setName("name")
      .setDescription("Config name to remove (e.g., QUEEN)")
      .setRequired(true)
  );

export const adminOnly = true;

export async function execute(interaction) {
  const name = interaction.options.getString("name").toUpperCase();

  const existing = getMod(name);
  if (!existing) {
    return interaction.reply({
      content: `❌ No mod registered with name **${name}**.`,
      ephemeral: true,
    });
  }

  removeMod(name);

  return interaction.reply({
    content: `✅ Removed **${name}** from the mod schedule.`,
    ephemeral: true,
  });
}
