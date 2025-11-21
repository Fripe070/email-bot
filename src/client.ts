import {
    type BaseInteraction,
    type ChatInputCommandInteraction,
    Client,
    type ClientOptions,
    Collection,
    Events,
    type Interaction,
} from "discord.js";
import type { BotCommand, InteractionHandler } from "./commands/command";

export class BotClient extends Client {
    public commands = new Collection<string, BotCommand>();
    public interactionHandlers = new Collection<string, InteractionHandler>();

    constructor(options: ClientOptions) {
        super(options);

        this.once(Events.ClientReady, ({ user }) => {
            console.log(`Bot started and logged in as: ${user.tag} (${user.id})`);
        });

        this.on(Events.InteractionCreate, async (interaction: Interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleCommand(interaction);
            } else {
                await this.handleInteraction(interaction);
            }
        });
    }

    public registerCommands(...commands: BotCommand[]): void {
        for (const command of commands) {
            if (this.commands.has(command.meta.name))
                throw new Error(`Command name ${command.meta.name} is already registered.`);
            this.commands.set(command.meta.name, command);

            for (const [customId, handler] of Object.entries(command.interactionHandlers ?? {})) {
                if (this.interactionHandlers.has(customId))
                    throw new Error(`Interaction handler ID ${customId} is already registered.`);
                this.interactionHandlers.set(customId, handler);
            }
        }
    }

    public async reportError(error: Error, interaction?: BaseInteraction) {
        console.error(error);
        if (interaction?.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "An error occurred.",
            });
        } else if (interaction?.isRepliable()) {
            await interaction.followUp({
                content: "An error occurred.",
            });
        }
    }

    protected async handleCommand(interaction: ChatInputCommandInteraction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command "${interaction.commandName}" was found.`);
            return;
        }
        try {
            await command.execute(interaction, this);
        } catch (error) {
            await this.reportError(error as Error, interaction);
        }
    }

    protected async handleInteraction(interaction: BaseInteraction) {
        const valid = interaction.isMessageComponent() || interaction.isModalSubmit();
        if (!valid) {
            console.warn(`Unsupported interaction type: ${interaction.type}`);
            return;
        }

        const handler = this.interactionHandlers.get(interaction.customId);
        if (!handler) {
            console.error(`No interaction handler "${interaction.customId}" was found.`);
            return;
        }
        try {
            await handler(interaction, this);
        } catch (error) {
            await this.reportError(error as Error, interaction);
        }
    }
}
