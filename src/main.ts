import { GatewayIntentBits } from "discord.js";
import { BotClient } from "./client";
import { DISCORD_TOKEN } from "./env";

const client = new BotClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

client.login(DISCORD_TOKEN);
