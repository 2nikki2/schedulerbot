import { Client, GatewayIntentBits, Collection } from "discord.js";
import { config } from "dotenv";
import { startPingEngine, stopPingEngine } from "./engines/ping.js";
import { closeDatabase } from "./db/database.js";

// Load environment variables
config();

// --- Import Commands ---
import * as registerMod from "./commands/register-mod.js";
import * as removeMod from "./commands/remove-mod.js";
import * as setChannel from "./commands/set-channel.js";
import * as weekendOncall from "./commands/weekend-oncall.js";
import * as myShifts from "./commands/my-shifts.js";
import * as onDuty from "./commands/on-duty.js";

// --- Discord Client Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- Register Commands ---
client.commands = new Collection();

const commandModules = [
  registerMod,
  removeMod,
  setChannel,
  weekendOncall,
  myShifts,
  onDuty,
];

for (const mod of commandModules) {
  client.commands.set(mod.data.name, mod);
}

// --- Event: Ready ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📡 Serving guild: ${process.env.DISCORD_GUILD_ID}`);

  // Start the ping engine tick loop (FR10)
  startPingEngine(client);
});

// --- Event: Interaction ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // Admin role check (FR22, NFR12)
    if (command.adminOnly) {
      const adminRoleName = process.env.ADMIN_ROLE_NAME || "Admin";
      const member = interaction.member;

      const hasAdminRole = member.roles.cache.some(
        (role) => role.name === adminRoleName
      );

      if (!hasAdminRole) {
        return interaction.reply({
          content: `❌ This command requires the **${adminRoleName}** role.`,
          ephemeral: true,
        });
      }
    }

    await command.execute(interaction);
  } catch (err) {
    console.error(`[Command Error] /${interaction.commandName}:`, err);

    const reply = {
      content: "❌ An error occurred while executing this command.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// --- Graceful Shutdown ---
function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  stopPingEngine();
  closeDatabase();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// --- Login (NFR13: token from env var) ---
client.login(process.env.DISCORD_TOKEN);
