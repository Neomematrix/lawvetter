ALTER TABLE `attorneys` ADD `employment_type` text DEFAULT 'Law Firm Attorney' NOT NULL;--> statement-breakpoint
ALTER TABLE `attorneys` ADD `employer_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attorneys` ADD `employer_website` text DEFAULT '' NOT NULL;