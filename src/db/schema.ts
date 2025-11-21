import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const emailThreads = sqliteTable(
    "email_threads",
    {
        channel_id: text().notNull().primaryKey(),
        thread_id: text().notNull().unique(),
        recording_message_id: text(),
    },
    (table) => [uniqueIndex("thread_id_idx").on(table.thread_id)],
);
