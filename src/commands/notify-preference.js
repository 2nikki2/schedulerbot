import { SlashCommandBuilder } from "discord.js";
import { getModByUserId, setNotifyPreference } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("notify-preference")
  .setDescription("Choose how you receive shift reminders: DM or channel mention")
  .addStringOption((opt) =>
    opt
      .setName("mode")
      .setDescription("How you want to be notified")
      .setRequired(true)
      .addChoices(
        { name: "DM — shift start + periodic reminders", value: "dm" },
        { name: "Channel — shift start notification only", value: "channel" }
      )
  );

export const adminOnly = false;

export async function execute(interaction) {
  const mode = interaction.options.getString("mode");

  // Look up the calling user in the mod registry
  const mod = getModByUserId(interaction.user.id);

  if (!mod) {
    return interaction.reply({
      content:
        "❌ You're not registered as a moderator. Ask an admin to run `/register-mod` for you first.",
      ephemeral: true,
    });
  }

  setNotifyPreference(mod.config_name, mode);

  const label = mode === "dm" ? "📩 DM (private message)" : "📢 Channel mention";

  const description = mode === "dm"
    ? "You'll get a DM when your shift starts **plus** periodic reminders every 30min (weekday) / 45min (weekend)."
    : "You'll get an @mention in the scheduler channel **only** when your shift starts. No repeated reminders.";

  return interaction.reply({
    content: `✅ Your notification preference is now set to **${label}**.\n${description}`,
    ephemeral: true,
  });
}
