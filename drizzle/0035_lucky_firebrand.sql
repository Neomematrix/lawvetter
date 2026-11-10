CREATE TABLE `admin_user_views` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`admin_token_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_user_views_session_idx` ON `admin_user_views` (`admin_token_hash`);