import { type ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export interface ChatCommand {
    data: SlashCommandBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const pingCommand = {
    data: new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!"),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: "Pong!" });
    },
};

const BotSlashCommands: ChatCommand[] = [pingCommand];
export default BotSlashCommands;
