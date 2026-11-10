CREATE TABLE `firm_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`firm_key` text NOT NULL,
	`firm_name` text NOT NULL,
	`user_id` text NOT NULL,
	`firm_email` text NOT NULL,
	`authority` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`firm_email_verified_at` text,
	`email_token_hash` text DEFAULT '' NOT NULL,
	`email_token_expires` integer DEFAULT 0 NOT NULL,
	`email_sent_at` integer DEFAULT 0 NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `firm_claims_user_firm_idx` ON `firm_claims` (`user_id`,`firm_key`);--> statement-breakpoint
CREATE INDEX `firm_claims_status_idx` ON `firm_claims` (`status`);--> statement-breakpoint
CREATE INDEX `firm_claims_token_idx` ON `firm_claims` (`email_token_hash`);--> statement-breakpoint
CREATE TABLE `firm_owners` (
	`firm_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`claim_id` text NOT NULL,
	`approved_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `firm_owners_user_idx` ON `firm_owners` (`user_id`);--> statement-breakpoint
ALTER TABLE `firm_settings` ADD `biography` text;