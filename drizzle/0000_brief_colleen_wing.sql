CREATE TABLE `accounts_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_table_id_unique` ON `accounts_table` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_table_email_unique` ON `accounts_table` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_table_username_unique` ON `accounts_table` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_table_password_hash_unique` ON `accounts_table` (`password_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_idx` ON `accounts_table` (`email`);--> statement-breakpoint
CREATE TABLE `meets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`description` text,
	`startTime` text,
	`endTime` text,
	`link` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meets_id_unique` ON `meets` (`id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`last_used_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `accounts_table`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text,
	`description` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	`file` text,
	`tags` text,
	FOREIGN KEY (`user_id`) REFERENCES `accounts_table`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_uploads_id_unique` ON `user_uploads` (`id`);