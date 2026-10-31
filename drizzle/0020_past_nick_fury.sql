CREATE TABLE `enrichment_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposal_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`note` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrichment_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`identity` text NOT NULL,
	`excerpt` text NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`rights` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrichment_firm_assets` (
	`firm_name` text PRIMARY KEY NOT NULL,
	`banner_key` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrichment_image_variants` (
	`desktop_key` text PRIMARY KEY NOT NULL,
	`mobile_key` text NOT NULL,
	`original_key` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrichment_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`bar_number` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`fingerprint` text NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `enrichment_scans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bar_number`) REFERENCES `attorneys`(`bar_number`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `enrichment_jobs_scan_idx` ON `enrichment_jobs` (`scan_id`,`status`);--> statement-breakpoint
CREATE TABLE `enrichment_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`kind` text NOT NULL,
	`field` text NOT NULL,
	`original` text NOT NULL,
	`proposed` text NOT NULL,
	`base_identity` text NOT NULL,
	`evidence_id` text NOT NULL,
	`explanation` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`decided_at` text,
	`actor` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `enrichment_scans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_id`) REFERENCES `enrichment_evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `enrichment_proposals_queue_idx` ON `enrichment_proposals` (`status`,`state`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `enrichment_proposals_entity_idx` ON `enrichment_proposals` (`entity`,`entity_id`,`field`);--> statement-breakpoint
CREATE TABLE `enrichment_receipts` (
	`bar_number` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`checked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `enrichment_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`night_key` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`created_at` text NOT NULL,
	`finished_at` text,
	`lease_token` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`scanned` integer DEFAULT 0 NOT NULL,
	`missing` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`requested_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrichment_scans_night_key_unique` ON `enrichment_scans` (`night_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX enrichment_one_active_scan ON enrichment_scans((1)) WHERE status IN ('queued','running');
--> statement-breakpoint
CREATE UNIQUE INDEX enrichment_night_key ON enrichment_scans(night_key) WHERE night_key IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER enrichment_proposal_immutable BEFORE UPDATE ON enrichment_proposals WHEN NEW.id IS NOT OLD.id OR NEW.scan_id IS NOT OLD.scan_id OR NEW.entity IS NOT OLD.entity OR NEW.entity_id IS NOT OLD.entity_id OR NEW.name IS NOT OLD.name OR NEW.state IS NOT OLD.state OR NEW.kind IS NOT OLD.kind OR NEW.field IS NOT OLD.field OR NEW.original IS NOT OLD.original OR NEW.proposed IS NOT OLD.proposed OR NEW.base_identity IS NOT OLD.base_identity OR NEW.evidence_id IS NOT OLD.evidence_id OR NEW.explanation IS NOT OLD.explanation OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'Proposal evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrichment_evidence_immutable BEFORE UPDATE ON enrichment_evidence BEGIN SELECT RAISE(ABORT,'Evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrichment_audit_immutable BEFORE UPDATE ON enrichment_audit BEGIN SELECT RAISE(ABORT,'Audit is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrichment_audit_no_delete BEFORE DELETE ON enrichment_audit BEGIN SELECT RAISE(ABORT,'Audit is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrichment_proposal_initial BEFORE INSERT ON enrichment_proposals WHEN NEW.status NOT IN ('pending','conflict') OR NEW.actor<>'' BEGIN SELECT RAISE(ABORT,'Proposals must begin unapproved'); END;
--> statement-breakpoint
CREATE TRIGGER enrichment_transition BEFORE UPDATE OF status ON enrichment_proposals BEGIN
 SELECT CASE WHEN NEW.actor='' OR NEW.decided_at IS NULL OR NOT (
 (OLD.status IN ('pending','deferred') AND NEW.status IN ('approved','rejected','deferred')) OR
 (OLD.status='conflict' AND NEW.status IN ('rejected','deferred')) OR
 (OLD.status='approved' AND NEW.status='rolled_back')) THEN RAISE(ABORT,'Invalid owner decision') END;
 END;
--> statement-breakpoint
CREATE TRIGGER enrichment_apply_guard BEFORE UPDATE OF status ON enrichment_proposals WHEN NEW.status='approved' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM enrichment_evidence e WHERE e.id=NEW.evidence_id AND e.verified=1 AND e.identity=NEW.base_identity AND (NEW.kind='text' OR e.rights<>'')) THEN RAISE(ABORT,'Unverified evidence or image rights') END;
 SELECT CASE WHEN NEW.proposed='' OR NOT EXISTS(SELECT 1 FROM enrichment_evidence e WHERE e.id=NEW.evidence_id AND julianday(e.retrieved_at)>=julianday('now','-30 days')) THEN RAISE(ABORT,'Missing or stale evidence') END;
SELECT CASE WHEN NOT (
 (NEW.entity='attorney' AND EXISTS(SELECT 1 FROM attorneys a WHERE a.bar_number=NEW.entity_id AND json_array(a.name,a.state,COALESCE(a.license_number,a.bar_number),a.source_url)=NEW.base_identity AND NOT EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=a.bar_number AND (p.owner_id<>'' OR p.claimed_at<>'')) AND NOT EXISTS(SELECT 1 FROM profile_claims c WHERE c.bar_number=a.bar_number AND c.status='approved') AND CASE NEW.field WHEN 'admit_date' THEN a.admit_date WHEN 'law_school' THEN a.law_school WHEN 'county' THEN a.county WHEN 'status' THEN a.status WHEN 'company' THEN a.company WHEN 'address' THEN a.address WHEN 'city' THEN a.city WHEN 'zip' THEN a.zip WHEN 'website' THEN COALESCE((SELECT website FROM attorney_profiles WHERE bar_number=a.bar_number),'') WHEN 'practice_areas' THEN COALESCE((SELECT practice_areas FROM attorney_profiles WHERE bar_number=a.bar_number),'') WHEN 'photo_key' THEN COALESCE((SELECT photo_key FROM attorney_profiles WHERE bar_number=a.bar_number),'') END=NEW.original)) OR
 (NEW.entity='firm' AND NEW.field='banner_key' AND NEW.base_identity=json_array(NEW.entity_id,NEW.state) AND EXISTS(SELECT 1 FROM attorneys WHERE company=NEW.entity_id AND state=NEW.state) AND COALESCE((SELECT banner_key FROM enrichment_firm_assets WHERE firm_name=NEW.entity_id),'')=NEW.original)
 ) THEN RAISE(ABORT,'Record changed or claimed; reload and research again') END;
 SELECT CASE WHEN NEW.kind IN ('photo','banner') AND NOT EXISTS(SELECT 1 FROM enrichment_image_variants WHERE desktop_key=NEW.proposed AND kind=NEW.kind) THEN RAISE(ABORT,'Image has not been staged') END;
END;
--> statement-breakpoint
CREATE TRIGGER enrichment_apply AFTER UPDATE OF status ON enrichment_proposals WHEN NEW.status='approved' BEGIN
UPDATE attorneys SET admit_date=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='admit_date';
UPDATE attorneys SET law_school=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='law_school';
UPDATE attorneys SET county=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='county';
UPDATE attorneys SET status=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='status';
UPDATE attorneys SET company=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='company';
UPDATE attorneys SET address=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='address';
UPDATE attorneys SET city=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='city';
UPDATE attorneys SET zip=NEW.proposed WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='zip';
INSERT OR IGNORE INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) SELECT NEW.entity_id,'','',NEW.decided_at WHERE NEW.entity='attorney' AND NEW.field IN ('website','practice_areas','photo_key');
UPDATE attorney_profiles SET website=NEW.proposed,updated_at=NEW.decided_at WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='website';
UPDATE attorney_profiles SET practice_areas=NEW.proposed,updated_at=NEW.decided_at WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='practice_areas';
UPDATE attorney_profiles SET photo_key=NEW.proposed,updated_at=NEW.decided_at WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='photo_key';
INSERT INTO enrichment_firm_assets(firm_name,banner_key) SELECT NEW.entity_id,NEW.proposed WHERE NEW.entity='firm' AND NEW.field='banner_key' ON CONFLICT(firm_name) DO UPDATE SET banner_key=excluded.banner_key;
END;
--> statement-breakpoint
CREATE TRIGGER enrichment_rollback_guard BEFORE UPDATE OF status ON enrichment_proposals WHEN NEW.status='rolled_back' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM enrichment_evidence e WHERE e.id=NEW.evidence_id AND e.verified=1 AND e.identity=NEW.base_identity AND (NEW.kind='text' OR e.rights<>'')) THEN RAISE(ABORT,'Unverified evidence or image rights') END;
 SELECT CASE WHEN NOT (
 (NEW.entity='attorney' AND EXISTS(SELECT 1 FROM attorneys a WHERE a.bar_number=NEW.entity_id AND json_array(a.name,a.state,COALESCE(a.license_number,a.bar_number),a.source_url)=NEW.base_identity AND NOT EXISTS(SELECT 1 FROM attorney_profiles p WHERE p.bar_number=a.bar_number AND (p.owner_id<>'' OR p.claimed_at<>'')) AND NOT EXISTS(SELECT 1 FROM profile_claims c WHERE c.bar_number=a.bar_number AND c.status='approved') AND CASE NEW.field WHEN 'admit_date' THEN a.admit_date WHEN 'law_school' THEN a.law_school WHEN 'county' THEN a.county WHEN 'status' THEN a.status WHEN 'company' THEN a.company WHEN 'address' THEN a.address WHEN 'city' THEN a.city WHEN 'zip' THEN a.zip WHEN 'website' THEN COALESCE((SELECT website FROM attorney_profiles WHERE bar_number=a.bar_number),'') WHEN 'practice_areas' THEN COALESCE((SELECT practice_areas FROM attorney_profiles WHERE bar_number=a.bar_number),'') WHEN 'photo_key' THEN COALESCE((SELECT photo_key FROM attorney_profiles WHERE bar_number=a.bar_number),'') END=NEW.proposed)) OR
 (NEW.entity='firm' AND NEW.field='banner_key' AND NEW.base_identity=json_array(NEW.entity_id,NEW.state) AND EXISTS(SELECT 1 FROM attorneys WHERE company=NEW.entity_id AND state=NEW.state) AND COALESCE((SELECT banner_key FROM enrichment_firm_assets WHERE firm_name=NEW.entity_id),'')=NEW.proposed)
 ) THEN RAISE(ABORT,'Record changed or claimed; reload and research again') END;
 END;
--> statement-breakpoint
CREATE TRIGGER enrichment_rollback AFTER UPDATE OF status ON enrichment_proposals WHEN NEW.status='rolled_back' BEGIN
UPDATE attorneys SET admit_date=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='admit_date';
UPDATE attorneys SET law_school=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='law_school';
UPDATE attorneys SET county=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='county';
UPDATE attorneys SET status=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='status';
UPDATE attorneys SET company=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='company';
UPDATE attorneys SET address=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='address';
UPDATE attorneys SET city=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='city';
UPDATE attorneys SET zip=NEW.original WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='zip';
INSERT OR IGNORE INTO attorney_profiles(bar_number,owner_id,claimed_at,updated_at) SELECT NEW.entity_id,'','',NEW.decided_at WHERE NEW.entity='attorney' AND NEW.field IN ('website','practice_areas','photo_key');
UPDATE attorney_profiles SET website=NEW.original,updated_at=NEW.decided_at WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='website';
UPDATE attorney_profiles SET practice_areas=NEW.original,updated_at=NEW.decided_at WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='practice_areas';
UPDATE attorney_profiles SET photo_key=NEW.original,updated_at=NEW.decided_at WHERE bar_number=NEW.entity_id AND NEW.entity='attorney' AND NEW.field='photo_key';
INSERT INTO enrichment_firm_assets(firm_name,banner_key) SELECT NEW.entity_id,NEW.original WHERE NEW.entity='firm' AND NEW.field='banner_key' ON CONFLICT(firm_name) DO UPDATE SET banner_key=excluded.banner_key;
END;
--> statement-breakpoint
CREATE TRIGGER enrichment_decision_audit AFTER UPDATE OF status ON enrichment_proposals BEGIN
 INSERT INTO enrichment_audit(proposal_id,action,actor,created_at,note) VALUES(NEW.id,NEW.status,NEW.actor,NEW.decided_at,NEW.note);
 END;
