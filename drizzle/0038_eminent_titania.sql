CREATE TABLE `directory_page_views` (
	`event_id` text PRIMARY KEY NOT NULL,
	`target_kind` text NOT NULL,
	`target_key` text NOT NULL,
	`source` text DEFAULT 'other' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `directory_page_views_target_idx` ON `directory_page_views` (`target_kind`,`target_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `firm_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_key` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `firm_messages_firm_idx` ON `firm_messages` (`firm_key`,`created_at`);