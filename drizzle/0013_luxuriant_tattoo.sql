CREATE TABLE `client_rejection_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text DEFAULT '' NOT NULL,
	`first_attempt` integer,
	`provider_id` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `client_verifications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_rejection_emails_verification_idx` ON `client_rejection_emails` (`verification_id`);--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `state` text DEFAULT 'GA' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `opposing_party` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `document_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `document_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `party_role` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `representation_start` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `representation_end` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_verifications` ADD `request_notes` text DEFAULT '' NOT NULL;