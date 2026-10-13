ALTER TABLE `attorneys` ADD `license_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `attorneys_state_license_idx` ON `attorneys` (`state`,`license_number`);