CREATE TABLE `inquiry_visitors` (
	`key` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`converted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiry_visitors_month_idx` ON `inquiry_visitors` (`month`);--> statement-breakpoint
ALTER TABLE `client_leads` ADD `attorney_bar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `attorney_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `notification_status` text DEFAULT 'not_queued' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `notification_payload` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `notification_first_attempt` integer;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `notification_lease` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `notification_provider_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `acknowledged_at` text;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `acknowledged_by` text;