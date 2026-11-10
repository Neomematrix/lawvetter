CREATE TABLE `attorney_profile_views` (
	`event_id` text PRIMARY KEY NOT NULL,
	`bar_number` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_views_bar_idx` ON `attorney_profile_views` (`bar_number`);--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `firm_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `firm_email_verified_at` text;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `email_token_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `email_token_expires` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `email_sent_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `evidence_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `evidence_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_claims` ADD `evidence_type` text DEFAULT '' NOT NULL;