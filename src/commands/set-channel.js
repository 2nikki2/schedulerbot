import { SlashCommandBuilder, ChannelType } from "discord.js";
import { setPingChannelId } from "../db/database.js";

export const data = new SlashCommandBuilder()
  .setName("set-channel")
  .setDescription("Set the channel for shift reminder pings (Admin only)")
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("The text channel for pings")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export const adminOnly = true;

export async function execute(interaction) {
  const channel = interaction.options.getChannel("channel");

  setPingChannelId(channel.id);

  return interaction.reply({
    content: `✅ Ping channel set to **#${channel.name}**. Shift reminders will be sent here.`,
    ephemeral: true,
  });
}
