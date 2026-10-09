CREATE TABLE `client_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `client_verification_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`verification_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`verification_id`) REFERENCES `client_verifications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bar_number` text NOT NULL,
	`legal_name` text NOT NULL,
	`court` text NOT NULL,
	`county` text NOT NULL,
	`docket` text NOT NULL,
	`relationship_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`source_url` text DEFAULT '' NOT NULL,
	`identity_evidence` text DEFAULT '' NOT NULL,
	`representation_evidence` text DEFAULT '' NOT NULL,
	`decision_note` text DEFAULT '' NOT NULL,
	`review_body` text DEFAULT '' NOT NULL,
	`public_mode` text DEFAULT 'anonymous' NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `client_profiles`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_verification_user_idx` ON `client_verifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `client_verification_status_idx` ON `client_verifications` (`status`);--> statement-breakpoint
CREATE INDEX `client_verification_bar_idx` ON `client_verifications` (`bar_number`);--> statement-breakpoint
CREATE INDEX `client_verification_relationship_idx` ON `client_verifications` (`relationship_key`);