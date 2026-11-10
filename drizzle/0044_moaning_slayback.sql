CREATE TABLE `ranking_profile_visits` (
	`event_id` text PRIMARY KEY NOT NULL,
	`target_kind` text NOT NULL,
	`target_key` text NOT NULL,
	`visitor_key` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ranking_visits_visitor_day_idx` ON `ranking_profile_visits` (`target_kind`,`target_key`,`visitor_key`,`day`);--> statement-breakpoint
CREATE INDEX `ranking_visits_target_date_idx` ON `ranking_profile_visits` (`target_kind`,`target_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `ranking_visits_date_idx` ON `ranking_profile_visits` (`created_at`,`target_kind`);