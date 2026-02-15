import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { data as registerMod } from "./register-mod.js";
import { data as removeMod } from "./remove-mod.js";
import { data as setChannel } from "./set-channel.js";
import { data as weekendOncall } from "./weekend-oncall.js";
import { data as myShifts } from "./my-shifts.js";
import { data as onDuty } from "./on-duty.js";
import { data as notifyPreference } from "./notify-preference.js";

config();

const commands = [
  registerMod,
  removeMod,
  setChannel,
  weekendOncall,
  myShifts,
  onDuty,
  notifyPreference,
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function deploy() {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );

    console.log(`✅ Successfully deployed ${data.length} commands.`);
  } catch (err) {
    console.error("❌ Failed to deploy commands:", err);
    process.exit(1);
  }
}

deploy();
