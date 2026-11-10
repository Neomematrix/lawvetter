CREATE TABLE `search_index_progress` (
	`id` integer PRIMARY KEY NOT NULL,
	`attorney_cursor` integer DEFAULT 0 NOT NULL,
	`firm_cursor` integer DEFAULT 0 NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attorneys_license_search_idx` ON `attorneys` (lower(COALESCE(license_number,bar_number)));--> statement-breakpoint
CREATE INDEX `attorneys_city_state_search_idx` ON `attorneys` (lower(trim(city)),`state`);--> statement-breakpoint
CREATE INDEX `attorneys_zip_search_idx` ON `attorneys` (substr(trim(zip),1,5));
--> statement-breakpoint
CREATE VIRTUAL TABLE attorney_search_fts USING fts5(name,company,firm_key,tokenize='trigram');
--> statement-breakpoint
CREATE VIRTUAL TABLE firm_search_fts USING fts5(name,firm_key,tokenize='trigram');
--> statement-breakpoint
CREATE TRIGGER attorney_search_fts_insert AFTER INSERT ON attorneys BEGIN INSERT OR REPLACE INTO attorney_search_fts(rowid,name,company,firm_key) VALUES(new.rowid,CASE WHEN new.bar_number='231458' THEN new.name||' Ted Tedd S' WHEN new.bar_number='004170' THEN new.name||' Randy' ELSE new.name END,new.company||' '||new.employer_name||' '||new.employment_type,CASE replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(new.company), '&', 'and'), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '.', ''), ',', ''), '-', ''), '''', ''), '’', ''), '/', ''), '(', ''), ')', '') WHEN 'thriftmclemore' THEN 'thriftmclemorellc' ELSE replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(new.company), '&', 'and'), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '.', ''), ',', ''), '-', ''), '''', ''), '’', ''), '/', ''), '(', ''), ')', '') END); END;
--> statement-breakpoint
CREATE TRIGGER attorney_search_fts_update AFTER UPDATE OF name,company,employer_name,employment_type,bar_number ON attorneys BEGIN DELETE FROM attorney_search_fts WHERE rowid=old.rowid; INSERT OR REPLACE INTO attorney_search_fts(rowid,name,company,firm_key) VALUES(new.rowid,CASE WHEN new.bar_number='231458' THEN new.name||' Ted Tedd S' WHEN new.bar_number='004170' THEN new.name||' Randy' ELSE new.name END,new.company||' '||new.employer_name||' '||new.employment_type,CASE replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(new.company), '&', 'and'), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '.', ''), ',', ''), '-', ''), '''', ''), '’', ''), '/', ''), '(', ''), ')', '') WHEN 'thriftmclemore' THEN 'thriftmclemorellc' ELSE replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(new.company), '&', 'and'), ' ', ''), char(9), ''), char(10), ''), char(13), ''), '.', ''), ',', ''), '-', ''), '''', ''), '’', ''), '/', ''), '(', ''), ')', '') END); END;
--> statement-breakpoint
CREATE TRIGGER attorney_search_fts_delete AFTER DELETE ON attorneys BEGIN DELETE FROM attorney_search_fts WHERE rowid=old.rowid; END;
--> statement-breakpoint
CREATE TRIGGER firm_search_fts_insert AFTER INSERT ON firm_settings BEGIN INSERT OR REPLACE INTO firm_search_fts(rowid,name,firm_key) VALUES(new.rowid,new.name,new.key); END;
--> statement-breakpoint
CREATE TRIGGER firm_search_fts_update AFTER UPDATE OF name,key ON firm_settings BEGIN DELETE FROM firm_search_fts WHERE rowid=old.rowid; INSERT OR REPLACE INTO firm_search_fts(rowid,name,firm_key) VALUES(new.rowid,new.name,new.key); END;
--> statement-breakpoint
CREATE TRIGGER firm_search_fts_delete AFTER DELETE ON firm_settings BEGIN DELETE FROM firm_search_fts WHERE rowid=old.rowid; END;
