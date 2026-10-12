CREATE TABLE `client_password_reset_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`requested_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `client_profiles`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_password_reset_tokens_user_idx` ON `client_password_reset_tokens` (`user_id`);