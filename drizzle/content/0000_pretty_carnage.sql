CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`edition` text,
	`source_url` text,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chunk_embeddings` (
	`chunk_id` text PRIMARY KEY NOT NULL,
	`embedding` blob NOT NULL,
	`model` text,
	`dim` integer,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	FOREIGN KEY (`chunk_id`) REFERENCES `textbook_chunks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `textbook_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_number` integer,
	`chapter_title` text,
	`section_number` text,
	`section_title` text,
	`pages` text,
	`topic_path` text,
	`level` text,
	`difficulty` integer,
	`order_in_section` integer,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
