import { SlashCommandBuilder } from "discord.js";
import { getModByUserId, setNotifyPreference } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("notify-preference")
  .setDescription("Choose how you receive shift reminders: DM, channel mention, or opt out")
  .addStringOption((opt) =>
    opt
      .setName("mode")
      .setDescription("How you want to be notified")
      .setRequired(true)
      .addChoices(
        { name: "DM — shift start + periodic reminders", value: "dm" },
        { name: "Channel — shift start notification only", value: "channel" },
        { name: "None — opt out of all notifications", value: "none" }
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

  const labels = {
    dm: "📩 DM (private message)",
    channel: "📢 Channel mention",
    none: "🔕 None (opted out)",
  };
  const descriptions = {
    dm: "You'll get a DM when your shift starts **plus** periodic reminders every 30min (weekday) / 45min (weekend).",
    channel: "You'll get an @mention in the scheduler channel **only** when your shift starts. No repeated reminders.",
    none: "You won't receive any shift notifications. You can change this anytime by running `/notify-preference` again.",
  };

  const label = labels[mode];
  const description = descriptions[mode];

  return interaction.reply({
    content: `✅ Your notification preference is now set to **${label}**.\n${description}`,
    ephemeral: true,
  });
}
