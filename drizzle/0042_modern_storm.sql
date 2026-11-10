CREATE TABLE `client_email_changes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`old_email` text NOT NULL,
	`new_email` text NOT NULL,
	`password_hash` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL
);
