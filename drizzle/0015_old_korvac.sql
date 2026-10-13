CREATE TABLE `review_moderation_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`first_attempt` integer,
	`provider_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `client_verifications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `review_draft` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `review_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `review_revision` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `review_submitted_at` text;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `review_decision_note` text DEFAULT '' NOT NULL;