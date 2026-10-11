CREATE TABLE `client_account_emails` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `client_profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_account_emails_user_idx` ON `client_account_emails` (`user_id`);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `first_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `last_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `initial_docket` text DEFAULT '' NOT NULL;