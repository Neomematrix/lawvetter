CREATE TABLE `directory_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`firm_name` text DEFAULT '' NOT NULL,
	`state` text NOT NULL,
	`bar_number` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`official_source_url` text NOT NULL,
	`submitter_name` text NOT NULL,
	`submitter_email` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`verification_status` text DEFAULT 'manual_official_check_required' NOT NULL,
	`verification_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text
);
--> statement-breakpoint
CREATE INDEX `directory_submissions_status_idx` ON `directory_submissions` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `directory_submissions_submitter_idx` ON `directory_submissions` (`submitter_email`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `directory_submissions_identity_idx` ON `directory_submissions` (`kind`,`state`,`bar_number`,`name`);