CREATE TABLE `attorneys` (
	`bar_number` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT 'GA' NOT NULL,
	`county` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`admit_date` text DEFAULT '' NOT NULL,
	`law_school` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`zip` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`source_url` text NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attorneys_name_idx` ON `attorneys` (`name`);--> statement-breakpoint
CREATE INDEX `attorneys_city_idx` ON `attorneys` (`city`);--> statement-breakpoint
CREATE INDEX `attorneys_status_idx` ON `attorneys` (`status`);