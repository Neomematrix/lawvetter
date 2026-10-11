CREATE TABLE `attorney_search_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`bar_number` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attorney_search_events_date_idx` ON `attorney_search_events` (`created_at`,`bar_number`);