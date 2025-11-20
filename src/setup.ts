import { Client, Events, Routes } from "discord.js";
import BotSlashCommands from "./commands";
import { DISCORD_TOKEN } from "./env";

const [syncEnvironment = "global"] = process.argv.slice(2);
console.log(`Running setup for environment: ${syncEnvironment}`);

if (syncEnvironment !== "global" && !/^\d+$/.test(syncEnvironment)) {
    console.error(`Unknown argument "${syncEnvironment}". Only a guild ID or "global" (default) are supported.`);
    process.exit(1);
}

const client = new Client({ intents: [] });

client.once(Events.ClientReady, (readyClient) => {
    const { user, application: app } = readyClient;
    console.log(`Bot started and logged in as: ${user.tag} (${user.id})`);

    const commands = BotSlashCommands.map((cmd) => cmd.data.toJSON());

    client.rest
        .put(
            syncEnvironment === "global"
                ? Routes.applicationCommands(app.id)
                : Routes.applicationGuildCommands(app.id, syncEnvironment),
            { body: commands },
        )
        .then(() => {
            console.log("Sent app commands to Discord API.");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Error sending app commands to Discord API:", error);
            process.exit(1);
        });
});

client.login(DISCORD_TOKEN);
