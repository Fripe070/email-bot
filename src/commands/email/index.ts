import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { type BotCommand, buildCommandGroup } from "../command";
import replySubCOmmand from "./reply";

export const emailGroupCmd: BotCommand = buildCommandGroup(
    new SlashCommandBuilder()
        .setName("email")
        .setDescription("Email related commands")
        .setContexts([InteractionContextType.Guild]),
    replySubCOmmand,
);
