CREATE TABLE `client_approval_emails` (
	`verification_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text DEFAULT '' NOT NULL,
	`first_attempt` integer,
	`provider_id` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `client_verifications`(`id`) ON UPDATE no action ON DELETE no action
);
