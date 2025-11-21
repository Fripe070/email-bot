import {
    ActionRowBuilder,
    type BaseInteraction,
    ButtonBuilder,
    type ButtonInteraction,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ContainerBuilder,
    type GuildBasedChannel,
    type MessageActionRowComponentBuilder,
    MessageFlags,
    ModalBuilder,
    PermissionFlagsBits,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";
import { eq, sql } from "drizzle-orm";
import type { BotClient } from "../../client";
import { Emojis, MAX_MESSAGE_STRING_LENGTH } from "../../constants";
import db from "../../db";
import { emailThreads } from "../../db/schema";
import { type BotSubCommand, wrongInteractType } from "../command";

const confirmButtonId = "email-reply-confirm";
const confirmButton = new ButtonBuilder()
    .setCustomId(confirmButtonId)
    .setLabel(`${Emojis.OUTBOX} Send Reply`)
    .setStyle(ButtonStyle.Success);
const cancelButtonId = "email-reply-cancel";
const cancelButton = new ButtonBuilder()
    .setCustomId(cancelButtonId)
    .setLabel(`${Emojis.CROSS} Cancel`)
    .setStyle(ButtonStyle.Danger);

const sendButtonId = "email-reply-send";
const sendButton = new ButtonBuilder()
    .setCustomId(sendButtonId)
    .setLabel(`${Emojis.OUTBOX} Confirm Send`)
    .setStyle(ButtonStyle.Success);

const sendModalId = "email-reply-modal";
const sendModal = new ModalBuilder()
    .setCustomId(sendModalId)
    .setTitle("Send Email")
    .addLabelComponents((label) =>
        label
            .setLabel("Subject")
            .setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId("subject")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Email subject line")
                    .setRequired(true),
            ),
    );

function toDisabled(button: ButtonBuilder) {
    return ButtonBuilder.from(button).setDisabled(true);
}

const recordingLocks = new Set<string>();

const replySubCOmmand: BotSubCommand = {
    build: (sub) => sub.setName("reply").setDescription("Reply to the email"),

    execute: async (interaction: ChatInputCommandInteraction) => {
        // TODO: Trigger through a button on the email message instead
        const sendNotAllowed = async (content: string) => {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `${Emojis.NO_ENTRY} ${content}`,
            });
        };
        if (recordingLocks.has(interaction.channelId)) {
            await sendNotAllowed("A reply is already being recorded.");
            return;
        }
        // Prevent race conditions while we're waiting for the DB/API
        recordingLocks.add(interaction.channelId);
        try {
            const guild = interaction.guild;
            if (!guild) {
                throw new Error("Guild not found for this interaction.");
            }
            const botMember = await guild.members.fetchMe();
            let channel: GuildBasedChannel | null = null;
            try {
                channel = await guild.channels.fetch(interaction.channelId);
            } catch (_) {}
            if (
                !channel ||
                !channel.isTextBased() ||
                !botMember
                    .permissionsIn(channel)
                    .has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory)
            ) {
                await sendNotAllowed(
                    'Permissions missing. Need "View Channel" and "Read Message History".',
                );
                return;
            }

            const [res]: { isRecording: boolean }[] = await db
                .select({
                    isRecording: sql<boolean>`${emailThreads.recording_message_id} IS NOT NULL`,
                })
                .from(emailThreads)
                .where(eq(emailThreads.channel_id, interaction.channelId))
                .limit(1);
            if (!res) {
                recordingLocks.delete(interaction.channelId);
                await sendNotAllowed("This channel is not an active email thread.");
                return;
            }
            if (res.isRecording) {
                await sendNotAllowed("A reply is already being recorded.");
                return;
            }
            const response = await interaction.reply({
                withResponse: true,
                flags: MessageFlags.IsComponentsV2,
                components: [
                    new TextDisplayBuilder().setContent("Recording reply..."),
                    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                        confirmButton,
                        cancelButton,
                    ),
                ],
            });
            const recordingMsgId = response.resource?.message?.id;
            if (!recordingMsgId) throw new Error("Failed to get recording message ID");
            await db
                .update(emailThreads)
                .set({ recording_message_id: recordingMsgId })
                .where(eq(emailThreads.channel_id, interaction.channelId));
        } finally {
            recordingLocks.delete(interaction.channelId);
        }
    },

    interactionHandlers: {
        [cancelButtonId]: async (interaction: BaseInteraction) => {
            if (!interaction.isButton()) wrongInteractType();
            await db
                .update(emailThreads)
                .set({ recording_message_id: null })
                .where(eq(emailThreads.channel_id, interaction.channelId));
            await interaction.update({
                components: [
                    new TextDisplayBuilder().setContent("Reply cancelled."),
                    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                        toDisabled(confirmButton),
                        toDisabled(cancelButton),
                    ),
                ],
            });
        },
        [confirmButtonId]: async (interaction: BaseInteraction, client: BotClient) => {
            if (!interaction.isButton()) wrongInteractType();
            const [{ recordingMessageId }] = await db
                .select({ recordingMessageId: emailThreads.recording_message_id })
                .from(emailThreads)
                .where(eq(emailThreads.channel_id, interaction.channelId))
                .limit(1);
            if (!recordingMessageId) {
                throw new Error("No recording message ID found for this channel.");
            }
            // Update original message
            await interaction.channel?.messages.edit(recordingMessageId, {
                components: [
                    new TextDisplayBuilder().setContent("Preparing reply..."),
                    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                        toDisabled(confirmButton),
                        toDisabled(cancelButton),
                    ),
                ],
            });
            const deferResponse = await interaction.deferUpdate({ withResponse: true });

            const channel = await client.channels.fetch(interaction.channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error("Channel not found or does not support text.");
            }
            const messages = await channel.messages.fetch({
                after: recordingMessageId,
                before: deferResponse.resource?.message?.id,
            });
            if (!messages) {
                await interaction.followUp({
                    content: `${Emojis.CROSS} Failed to fetch messages for reply.`,
                });
                return;
            }

            const replyContent: string = messages.reverse().reduce((response, msg) => {
                return `${response + msg.content}\n`;
            }, "");
            if (replyContent.length === 0) {
                await interaction.followUp({
                    content: `${Emojis.CROSS} No content found to send in reply.`,
                });
                return;
            }
            const sliced = replyContent.slice(0, MAX_MESSAGE_STRING_LENGTH);

            const sendingText = "Sending:";
            await interaction.followUp({
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
                components: [
                    new TextDisplayBuilder().setContent(sendingText),
                    new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            sliced.length < replyContent.length ? `${sliced}...` : replyContent,
                        ),
                    ),
                    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                        sendButton,
                    ),
                ],
            });
        },
        [sendButtonId]: async (interaction: BaseInteraction) => {
            if (!interaction.isButton()) wrongInteractType();
            await interaction.showModal(sendModal);
        },
        [sendModalId]: async (interaction: BaseInteraction) => {
            if (!interaction.isModalSubmit()) wrongInteractType();
            const subjectLine = interaction.fields.getTextInputValue("subject");

            // FIXME: This works, but is a crime against the type checker
            await (interaction as unknown as ButtonInteraction).update({
                components: [new TextDisplayBuilder().setContent(`Sending email "${subjectLine}"`)],
            });
        },
    },
};
export default replySubCOmmand;
