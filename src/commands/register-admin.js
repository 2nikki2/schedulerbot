import { SlashCommandBuilder } from "discord.js";
import { registerAdmin, getAllAdmins } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("register-admin")
  .setDescription("Register a user to receive admin log DMs (Admin only)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The Discord user to add as admin").setRequired(true)
  );

export const adminOnly = true;

export async function execute(interaction) {
  const user = interaction.options.getUser("user");

  registerAdmin(user.id);

  const allAdmins = getAllAdmins();
  const adminList = allAdmins.map((a) => `<@${a.discord_user_id}>`).join(", ");

  return interaction.reply({
    content: `✅ **${user.username}** will now receive admin log DMs.\n\n📋 **Current admin list:** ${adminList}`,
    ephemeral: true,
  });
}
