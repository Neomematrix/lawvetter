ALTER TABLE `client_leads` ADD `urgency` text DEFAULT 'routine' NOT NULL;--> statement-breakpoint
ALTER TABLE `client_leads` ADD `attorney_read_at` text;--> statement-breakpoint
CREATE INDEX `leads_attorney_created_idx` ON `client_leads` (`attorney_bar`,`created_at`);