import { SlashCommandBuilder } from "discord.js";
import { getAllMods, getAllAdmins } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("list-roster")
  .setDescription("List all registered mods and admins");

export const adminOnly = false;

export async function execute(interaction) {
  const mods = getAllMods();
  const admins = getAllAdmins();

  // Build mod list
  let modList;
  if (mods.length > 0) {
    modList = mods
      .map(
        (m) =>
          `• <@${m.discord_user_id}> — **${m.config_name}** · \`${m.timezone}\` · ${{ dm: "📩 DM", channel: "📢 Channel", none: "🔕 Off" }[m.notify_preference] || "📩 DM"}`
      )
      .join("\n");
  } else {
    modList = "*(none registered)*";
  }

  // Build admin list
  let adminList;
  if (admins.length > 0) {
    adminList = admins.map((a) => `• <@${a.discord_user_id}>`).join("\n");
  } else {
    adminList = "*(none registered)*";
  }

  return interaction.reply({
    content:
      `👥 **Registered Mods (${mods.length})**\n${modList}\n\n` +
      `🛡️ **Registered Admins (${admins.length})**\n${adminList}`,
    ephemeral: true,
  });
}
