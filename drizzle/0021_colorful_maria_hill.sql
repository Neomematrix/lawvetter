CREATE TABLE `admin_mfa` (
	`email` text PRIMARY KEY NOT NULL,
	`secret` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`last_step` integer DEFAULT -1 NOT NULL,
	`pending_secret` text DEFAULT '' NOT NULL,
	`pending_expires` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_recovery_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `admin_challenges` ADD `method` text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE `attorneys` ADD `owner_edited` integer DEFAULT 0 NOT NULL;