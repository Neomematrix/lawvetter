CREATE TABLE `attorney_profiles` (
	`bar_number` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`practice_areas` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`photo_key` text DEFAULT '' NOT NULL,
	`claimed_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profiles_owner_idx` ON `attorney_profiles` (`owner_id`);--> statement-breakpoint
CREATE TABLE `profile_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`bar_number` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`verification` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claims_status_idx` ON `profile_claims` (`status`);--> statement-breakpoint
CREATE INDEX `claims_user_idx` ON `profile_claims` (`user_id`);