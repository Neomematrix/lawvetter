CREATE TABLE `client_verification_request_emails` (
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
CREATE INDEX `client_verification_request_emails_verification_idx` ON `client_verification_request_emails` (`verification_id`);
