import { type ChatInputCommandInteraction, Client, type ClientOptions, Collection, Events } from "discord.js";
import BotSlashCommands, { type ChatCommand } from "./commands";

export class BotClient extends Client {
    public commands = new Collection<string, ChatCommand>();

    constructor(options: ClientOptions) {
        super(options);
        BotSlashCommands.forEach((command) => {
            this.commands.set(command.data.name, command);
        });

        this.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleCommand(interaction);
            } else {
                console.warn("Unknown interaction received.");
            }
        });

        this.once(Events.ClientReady, ({ user }) => {
            console.log(`Bot started and logged in as: ${user.tag} (${user.id})`);
        });
    }

    async handleCommand(interaction: ChatInputCommandInteraction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command "${interaction.commandName}" was found.`);
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
        }
    }
}
