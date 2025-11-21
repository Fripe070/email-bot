CREATE TABLE `email_threads` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`recording_message_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_threads_thread_id_unique` ON `email_threads` (`thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `thread_id_idx` ON `email_threads` (`thread_id`);