CREATE TABLE `google_firm_arrivals` (
	`event_key` text PRIMARY KEY NOT NULL,
	`firm_key` text NOT NULL,
	`firm_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `google_firm_arrivals_target_idx` ON `google_firm_arrivals` (`firm_key`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `search_referral_visits` (
	`event_key` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`bar_number` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `search_referral_date` ON `search_referral_visits` (`created_at`);--> statement-breakpoint
CREATE INDEX `search_referral_attorney_idx` ON `search_referral_visits` (`source`,`bar_number`,`created_at`);