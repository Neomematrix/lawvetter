CREATE TABLE `referral_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`first_attempt` integer NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `client_leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `referral_notices_lead_idx` ON `referral_notifications` (`lead_id`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
