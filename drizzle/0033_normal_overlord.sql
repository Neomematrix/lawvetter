ALTER TABLE `attorneys` ADD `public_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `attorneys_public_id_idx` ON `attorneys` (`public_id`);--> statement-breakpoint
CREATE TRIGGER attorneys_assign_public_id AFTER INSERT ON attorneys WHEN NEW.public_id IS NULL BEGIN UPDATE attorneys SET public_id=lower(hex(randomblob(16))) WHERE bar_number=NEW.bar_number; END;
