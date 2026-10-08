CREATE TABLE `firm_search_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`firm_key` text NOT NULL,
	`firm_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `firm_search_events_date_idx` ON `firm_search_events` (`created_at`,`firm_key`);--> statement-breakpoint
CREATE TABLE `shortlist` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bar_number` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shortlist_user_idx` ON `shortlist` (`user_id`);