CREATE TABLE `client_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text NOT NULL,
	`practice` text NOT NULL,
	`summary` text NOT NULL,
	`contact_method` text NOT NULL,
	`consent_version` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `client_leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_email_created_idx` ON `client_leads` (`email`,`created_at`);