DROP INDEX `attorneys_state_license_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `attorneys_state_license_idx` ON `attorneys` (`state`, COALESCE(`license_number`,`bar_number`));
