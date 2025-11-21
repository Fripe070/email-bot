import { GatewayIntentBits } from "discord.js";
import { BotClient } from "./client";
import botCommands from "./commands";
import { DISCORD_TOKEN } from "./env";

const client = new BotClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});
client.registerCommands(...botCommands);

client.login(DISCORD_TOKEN);
