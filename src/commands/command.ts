import type {
    BaseInteraction,
    ChatInputCommandInteraction,
    SharedSlashCommand,
    SlashCommandSubcommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { BotClient } from "../client";

export type InteractionHandler = (interaction: BaseInteraction, client: BotClient) => Promise<void>;

export interface BotCommand {
    meta: SharedSlashCommand;
    execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
    interactionHandlers?: Record<string, InteractionHandler>;
}
export interface BotSubCommand {
    build: (subcommandGroup: SlashCommandSubcommandBuilder) => SlashCommandSubcommandBuilder;
    execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
    interactionHandlers?: Record<string, InteractionHandler>;
}

export function wrongInteractType(): never {
    throw new Error("Invalid interaction type.");
}

export function buildCommandGroup(
    meta: SlashCommandSubcommandsOnlyBuilder,
    ...subcommands: BotSubCommand[]
): BotCommand {
    const interactionHandlerMap = new Map<
        string,
        (interaction: BaseInteraction, client: BotClient) => Promise<void>
    >();
    const subCommandMap = new Map<
        string,
        (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>
    >();

    let groupMeta = meta;
    for (const subCommand of subcommands) {
        // Register all the subcommands
        groupMeta = groupMeta.addSubcommand((sub) => {
            const built = subCommand.build(sub);
            subCommandMap.set(built.name, subCommand.execute);
            return built;
        });
        // Bubble up all the interaction handlers
        for (const [customId, handler] of Object.entries(subCommand.interactionHandlers ?? {})) {
            if (interactionHandlerMap.has(customId))
                throw new Error(
                    `Interaction handler ID ${customId} is already registered in command group.`,
                );
            interactionHandlerMap.set(customId, handler);
        }
    }

    return {
        meta: groupMeta,
        async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
            const subcommandName = interaction.options.getSubcommand();
            const subcommandExecutor = subCommandMap.get(subcommandName);
            if (!subcommandExecutor) {
                throw new Error(`No subcommand executor found for ${subcommandName}`);
            }
            await subcommandExecutor(interaction, client);
        },
        interactionHandlers: Object.fromEntries(interactionHandlerMap),
    };
}
