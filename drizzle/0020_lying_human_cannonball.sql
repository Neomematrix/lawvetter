CREATE TABLE `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`record_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_challenges` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `firm_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_visits` (
	`key` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`day` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_visits_day_idx` ON `site_visits` (`day`);--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD `last_seen` integer DEFAULT 0 NOT NULL;