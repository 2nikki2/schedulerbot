import { SlashCommandBuilder } from "discord.js";
import { removeAdmin, getAllAdmins } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("remove-admin")
  .setDescription("Remove a user from admin log notifications (Admin only)")
  .addUserOption((opt) =>
    opt.setName("user").setDescription("The Discord user to remove").setRequired(true)
  );

export const adminOnly = true;

export async function execute(interaction) {
  const user = interaction.options.getUser("user");

  removeAdmin(user.id);

  const allAdmins = getAllAdmins();
  const adminList = allAdmins.length > 0
    ? allAdmins.map((a) => `<@${a.discord_user_id}>`).join(", ")
    : "*(none)*";

  return interaction.reply({
    content: `✅ **${user.username}** has been removed from admin log notifications.\n\n📋 **Current admin list:** ${adminList}`,
    ephemeral: true,
  });
}
