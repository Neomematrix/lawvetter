import {firmColumn} from '../app/api/attorneys/firm';
import {sql} from 'drizzle-orm';
import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const attorneys = sqliteTable('attorneys', {
 barNumber: text('bar_number').primaryKey(),
 publicId: text('public_id'),
 licenseNumber: text('license_number'),
 sourceId: text('source_id').notNull(),
 name: text('name').notNull(),
 company: text('company').notNull().default(''),
 employmentType:text('employment_type').notNull().default('Law Firm Attorney'),
 employerName:text('employer_name').notNull().default(''),
 employerWebsite:text('employer_website').notNull().default(''),
 city: text('city').notNull().default(''),
 state: text('state').notNull().default('GA'),
 county: text('county').notNull().default(''),
 status: text('status').notNull(),
 admitDate: text('admit_date').notNull().default(''),
 lawSchool: text('law_school').notNull().default(''),
 address: text('address').notNull().default(''),
 zip: text('zip').notNull().default(''),
 phone: text('phone').notNull().default(''),
 email: text('email').notNull().default(''),
 sourceUrl: text('source_url').notNull(),
 importedAt: text('imported_at').notNull(),ownerEdited:integer('owner_edited').notNull().default(0),
}, t => [uniqueIndex('attorneys_public_id_idx').on(t.publicId),uniqueIndex('attorneys_state_license_idx').on(t.state,sql`NULLIF(COALESCE(license_number,bar_number),'')`),index('attorneys_state_source_idx').on(t.state,t.sourceUrl),index('attorneys_firm_key_idx').on(sql.raw(firmColumn())),index('attorneys_name_idx').on(t.name),index('attorneys_license_search_idx').on(sql`lower(COALESCE(license_number,bar_number))`),index('attorneys_city_state_search_idx').on(sql`lower(trim(city))`,t.state),index('attorneys_zip_search_idx').on(sql`substr(trim(zip),1,5)`), index('attorneys_city_idx').on(t.city), index('attorneys_status_idx').on(t.status)]);

export const attorneySearchEvents = sqliteTable('attorney_search_events', {
 eventId: text('event_id').primaryKey(),
 barNumber: text('bar_number').notNull().references(() => attorneys.barNumber),
 createdAt: text('created_at').notNull(),
}, t => [index('attorney_search_events_date_idx').on(t.createdAt, t.barNumber),index('attorney_search_events_bar_date_idx').on(t.barNumber,t.createdAt)]);

export const firmSearchEvents = sqliteTable('firm_search_events', {
 eventId: text('event_id').primaryKey(),
 firmKey: text('firm_key').notNull(),
 firmName: text('firm_name').notNull(),
 createdAt: text('created_at').notNull(),
}, t => [index('firm_search_events_date_idx').on(t.createdAt,t.firmKey)]);

export const shortlist = sqliteTable('shortlist', {
 id: text('id').primaryKey(),
 userId: text('user_id').notNull(),
 barNumber: text('bar_number').notNull().references(() => attorneys.barNumber),
 createdAt: text('created_at').notNull(),
}, t => [index('shortlist_user_idx').on(t.userId)]);

export const profileClaims = sqliteTable('profile_claims', {
 id: text('id').primaryKey(),
 barNumber: text('bar_number').notNull().references(() => attorneys.barNumber),
 userId: text('user_id').notNull(),
 email: text('email').notNull(),
 fullName: text('full_name').notNull(),
 verification: text('verification').notNull(),
 firmEmail:text('firm_email').notNull().default(''),
 firmEmailVerifiedAt:text('firm_email_verified_at'),
 emailTokenHash:text('email_token_hash').notNull().default(''),
 emailTokenExpires:integer('email_token_expires').notNull().default(0),
 emailSentAt:integer('email_sent_at').notNull().default(0),
 evidenceKey:text('evidence_key').notNull().default(''),
 evidenceName:text('evidence_name').notNull().default(''),
 evidenceType:text('evidence_type').notNull().default(''),
 status: text('status').notNull().default('pending'),
 reviewNote: text('review_note').notNull().default(''),
 submittedAt: text('submitted_at').notNull(),
 reviewedAt: text('reviewed_at'),
 reviewedBy: text('reviewed_by'),
},t=>[index('claims_status_idx').on(t.status),index('claims_user_idx').on(t.userId)]);
export const attorneyProfiles = sqliteTable('attorney_profiles', {
 languages: text('languages').notNull().default(''),
 hideBarNumber:integer('hide_bar_number').notNull().default(0),
 barNumber: text('bar_number').primaryKey().references(() => attorneys.barNumber),
 ownerId: text('owner_id').notNull(),
 headline: text('headline').notNull().default(''),
 bio: text('bio').notNull().default(''),
 practiceAreas: text('practice_areas').notNull().default(''),
 website: text('website').notNull().default(''),
 linkedInUrl:text('linkedin_url'),
 photoKey: text('photo_key').notNull().default(''),
 claimedAt: text('claimed_at').notNull(),
 updatedAt: text('updated_at').notNull(),
},t=>[index('profiles_owner_idx').on(t.ownerId)]);

export const inquiryVisitors=sqliteTable('inquiry_visitors',{
 key:text('key').primaryKey(),month:text('month').notNull(),converted:integer('converted').notNull().default(0),
},t=>[index('inquiry_visitors_month_idx').on(t.month)]);
export const clientLeads = sqliteTable('client_leads', {
 urgency:text('urgency').notNull().default('routine'),
 attorneyReadAt:text('attorney_read_at'),
 attorneyBar:text('attorney_bar').notNull().default(''),
 attorneyName:text('attorney_name').notNull().default(''),
 notificationStatus:text('notification_status').notNull().default('not_queued'),
 notificationPayload:text('notification_payload').notNull().default(''),
 notificationFirstAttempt:integer('notification_first_attempt'),
 notificationLease:integer('notification_lease').notNull().default(0),
 notificationProviderId:text('notification_provider_id').notNull().default(''),
 acknowledgedAt:text('acknowledged_at'),
 acknowledgedBy:text('acknowledged_by'),
 id:text('id').primaryKey(),
 name:text('name').notNull(),
 email:text('email').notNull(),
 phone:text('phone').notNull().default(''),
 city:text('city').notNull(),
 practice:text('practice').notNull(),
 summary:text('summary').notNull(),
 contactMethod:text('contact_method').notNull(),
 consentVersion:text('consent_version').notNull(),
 status:text('status').notNull().default('new'),
 createdAt:text('created_at').notNull(),
 updatedAt:text('updated_at').notNull(),
},t=>[index('leads_created_idx').on(t.createdAt),index('leads_email_created_idx').on(t.email,t.createdAt),index('leads_attorney_created_idx').on(t.attorneyBar,t.createdAt)]);

export const newsState = sqliteTable('news_state', {
 id: text('id').primaryKey(),
 payload: text('payload').notNull(),
 updatedAt: text('updated_at').notNull(),
});

export const clientProfiles = sqliteTable('client_profiles', {
 userId:text('user_id').primaryKey(),
 phone:text('phone').notNull().default(''),
 firstName:text('first_name').notNull().default(''),
 lastName:text('last_name').notNull().default(''),
 initialDocket:text('initial_docket').notNull().default(''),
 legalName:text('legal_name').notNull(),
 email:text('email').notNull(),
 createdAt:text('created_at').notNull(),
});
export const clientVerifications = sqliteTable('client_verifications', {
 evidenceKey:text('evidence_key').notNull().default(''),
 evidenceName:text('evidence_name').notNull().default(''),
 evidenceType:text('evidence_type').notNull().default(''),
 id:text('id').primaryKey(),
 userId:text('user_id').notNull().references(()=>clientProfiles.userId),
 barNumber:text('bar_number').notNull().references(()=>attorneys.barNumber),
 legalName:text('legal_name').notNull(),
 court:text('court').notNull(),
 county:text('county').notNull(),
 state:text('state').notNull().default('GA'),
 opposingParty:text('opposing_party').notNull().default(''),
 documentName:text('document_name').notNull().default(''),
 documentDate:text('document_date').notNull().default(''),
 partyRole:text('party_role').notNull().default(''),
 representationStart:text('representation_start').notNull().default(''),
 representationEnd:text('representation_end').notNull().default(''),
 requestNotes:text('request_notes').notNull().default(''),
 docket:text('docket').notNull(),
 relationshipKey:text('relationship_key').notNull(),
 status:text('status').notNull().default('pending'),
 submittedAt:text('submitted_at').notNull(),
 reviewedAt:text('reviewed_at'),
 reviewedBy:text('reviewed_by'),
 sourceUrl:text('source_url').notNull().default(''),
 identityEvidence:text('identity_evidence').notNull().default(''),
 representationEvidence:text('representation_evidence').notNull().default(''),
 decisionNote:text('decision_note').notNull().default(''),
 reviewBody:text('review_body').notNull().default(''),
 reviewDraft:text('review_draft').notNull().default(''),
 reviewStatus:text('review_status').notNull().default(''),
 reviewRevision:text('review_revision').notNull().default(''),
 reviewSubmittedAt:text('review_submitted_at'),
 reviewDecisionNote:text('review_decision_note').notNull().default(''),
 ratingUseAgain:integer('rating_use_again'),
 ratingCaredFor:integer('rating_cared_for'),
 ratingRights:integer('rating_rights'),
 ratingOutcome:integer('rating_outcome'),
 publicMode:text('public_mode').notNull().default('anonymous'),
 publishedAt:text('published_at'),
 updatedAt:text('updated_at').notNull(),
},t=>[index('client_verification_user_idx').on(t.userId),index('client_verification_status_idx').on(t.status),index('client_verification_bar_idx').on(t.barNumber),index('client_reviews_status_date_idx').on(t.status,t.publishedAt,t.barNumber),index('client_verification_relationship_idx').on(t.relationshipKey)]);
export const clientVerificationAudit = sqliteTable('client_verification_audit', {
 id:text('id').primaryKey(),
 verificationId:text('verification_id').notNull().references(()=>clientVerifications.id),
 actorId:text('actor_id').notNull(),
 action:text('action').notNull(),
 note:text('note').notNull(),
 createdAt:text('created_at').notNull(),
});

// Email is the unique external account identifier; stable user IDs retain review ownership.
export const clientAccountEmails = sqliteTable('client_account_emails', {
 email:text('email').primaryKey(),
 userId:text('user_id').notNull().references(()=>clientProfiles.userId),
},t=>[uniqueIndex('client_account_emails_user_idx').on(t.userId)]);

export const clientPasswords=sqliteTable('client_passwords',{
 userId:text('user_id').primaryKey().references(()=>clientProfiles.userId),
 passwordHash:text('password_hash').notNull(),
 updatedAt:text('updated_at').notNull(),
});
export const clientSessions=sqliteTable('client_sessions',{
 tokenHash:text('token_hash').primaryKey(),
 userId:text('user_id').notNull().references(()=>clientProfiles.userId),
 expiresAt:integer('expires_at').notNull(),
},t=>[index('client_sessions_user_idx').on(t.userId)]);
export const clientAuthLimits=sqliteTable('client_auth_limits',{
 key:text('key').primaryKey(),
 count:integer('count').notNull(),
 expiresAt:integer('expires_at').notNull(),
});
export const clientPasswordResetTokens=sqliteTable('client_password_reset_tokens',{
 tokenHash:text('token_hash').primaryKey(),
 userId:text('user_id').notNull().references(()=>clientProfiles.userId),
 expiresAt:integer('expires_at').notNull(),
 requestedAt:text('requested_at').notNull(),
},t=>[index('client_password_reset_tokens_user_idx').on(t.userId)]);
export const clientApprovalEmails=sqliteTable('client_approval_emails',{
 verificationId:text('verification_id').primaryKey().references(()=>clientVerifications.id),
 id:text('id').notNull(),
 recipient:text('recipient').notNull(),
 status:text('status').notNull().default('pending'),
 payload:text('payload').notNull().default(''),
 firstAttempt:integer('first_attempt'),
 providerId:text('provider_id').notNull().default(''),
});
export const clientVerificationRequestEmails=sqliteTable('client_verification_request_emails',{
 id:text('id').primaryKey(),
 verificationId:text('verification_id').notNull().references(()=>clientVerifications.id),
 recipient:text('recipient').notNull(),
 status:text('status').notNull().default('pending'),
 payload:text('payload').notNull().default(''),
 firstAttempt:integer('first_attempt'),
 providerId:text('provider_id').notNull().default(''),
 createdAt:text('created_at').notNull(),
},t=>[index('client_verification_request_emails_verification_idx').on(t.verificationId)]);

export const directorySubmissions=sqliteTable('directory_submissions',{
 id:text('id').primaryKey(),
 kind:text('kind').notNull(),
 name:text('name').notNull(),
 firmName:text('firm_name').notNull().default(''),
 state:text('state').notNull(),
 barNumber:text('bar_number').notNull().default(''),
 city:text('city').notNull().default(''),
 website:text('website').notNull().default(''),
 officialSourceUrl:text('official_source_url').notNull(),
 submitterName:text('submitter_name').notNull(),
 submitterEmail:text('submitter_email').notNull(),
 notes:text('notes').notNull().default(''),
 verificationStatus:text('verification_status').notNull().default('manual_official_check_required'),
 verificationNote:text('verification_note').notNull().default(''),
 status:text('status').notNull().default('pending'),
 reviewNote:text('review_note').notNull().default(''),
 submittedAt:text('submitted_at').notNull(),
 reviewedAt:text('reviewed_at'),
 reviewedBy:text('reviewed_by'),
},t=>[
 index('directory_submissions_status_idx').on(t.status,t.submittedAt),
 index('directory_submissions_submitter_idx').on(t.submitterEmail,t.submittedAt),
 index('directory_submissions_identity_idx').on(t.kind,t.state,t.barNumber,t.name),
]);

export const clientRejectionEmails=sqliteTable('client_rejection_emails',{
 id:text('id').primaryKey(),
 verificationId:text('verification_id').notNull().references(()=>clientVerifications.id),
 recipient:text('recipient').notNull(),
 status:text('status').notNull().default('pending'),
 payload:text('payload').notNull().default(''),
 firstAttempt:integer('first_attempt'),
 providerId:text('provider_id').notNull().default(''),
 createdAt:text('created_at').notNull(),
},t=>[index('client_rejection_emails_verification_idx').on(t.verificationId)]);

export const reviewModerationEmails=sqliteTable('review_moderation_emails',{
 id:text('id').primaryKey(),
 verificationId:text('verification_id').notNull().references(()=>clientVerifications.id),
 recipient:text('recipient').notNull(),
 status:text('status').notNull().default('pending'),
 payload:text('payload').notNull(),
 firstAttempt:integer('first_attempt'),
 providerId:text('provider_id'),
 createdAt:text('created_at').notNull(),
});

export const adminCredentials=sqliteTable('admin_credentials',{
 email:text('email').primaryKey(),passwordHash:text('password_hash').notNull(),updatedAt:text('updated_at').notNull(),
});
export const adminSessions=sqliteTable('admin_sessions',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),expiresAt:integer('expires_at').notNull(),lastSeen:integer('last_seen').notNull().default(0),
});
export const adminPasswordTokens=sqliteTable('admin_password_tokens',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),expiresAt:integer('expires_at').notNull(),
});

export const adminChallenges=sqliteTable('admin_challenges',{
 tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),codeHash:text('code_hash').notNull(),expiresAt:integer('expires_at').notNull(),method:text('method').notNull().default('email'),attempts:integer('attempts').notNull().default(0),
});
export const siteVisits=sqliteTable('site_visits',{
 key:text('key').primaryKey(),visitor:text('visitor').notNull(),day:text('day').notNull(),
},t=>[index('site_visits_day_idx').on(t.day)]);
export const adminAudit=sqliteTable('admin_audit',{
 id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),recordId:text('record_id').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('admin_audit_action_record_idx').on(t.action,t.recordId)]);
export const firmSettings=sqliteTable('firm_settings',{
 organizationType:text('organization_type').notNull().default('Law Firm'),
 practiceAreas:text('practice_areas').notNull().default(''),
 biography:text('biography'),additionalLocations:text('additional_locations').notNull().default('[]'),key:text('key').primaryKey(),name:text('name').notNull().default(''),address:text('address').notNull().default(''),zip:text('zip').notNull().default(''),phone:text('phone').notNull().default(''),email:text('email').notNull().default(''),city:text('city').notNull().default(''),state:text('state').notNull().default(''),bannerKey:text('banner_key').notNull().default(''),website:text('website').notNull().default(''),linkedInUrl:text('linkedin_url'),updatedAt:text('updated_at').notNull(),
});

export const adminMfa=sqliteTable('admin_mfa',{
 email:text('email').primaryKey(),secret:text('secret').notNull().default(''),enabled:integer('enabled').notNull().default(0),lastStep:integer('last_step').notNull().default(-1),pendingSecret:text('pending_secret').notNull().default(''),pendingExpires:integer('pending_expires').notNull().default(0),updatedAt:text('updated_at').notNull(),
});
export const adminRecoveryCodes=sqliteTable('admin_recovery_codes',{
 codeHash:text('code_hash').primaryKey(),email:text('email').notNull(),
});

export const attorneyProfileViews=sqliteTable('attorney_profile_views',{eventId:text('event_id').primaryKey(),barNumber:text('bar_number').notNull().references(()=>attorneys.barNumber),createdAt:text('created_at').notNull()},t=>[index('profile_views_bar_idx').on(t.barNumber)]);

export const siteSettings=sqliteTable('site_settings',{key:text('key').primaryKey(),value:text('value').notNull(),updatedAt:text('updated_at').notNull()});
export const referralNotifications=sqliteTable('referral_notifications',{
 id:text('id').primaryKey(),leadId:text('lead_id').notNull().references(()=>clientLeads.id),ownerId:text('owner_id').notNull(),email:text('email').notNull(),status:text('status').notNull().default('pending'),providerId:text('provider_id').notNull().default(''),payload:text('payload').notNull(),firstAttempt:integer('first_attempt').notNull(),lease:integer('lease').notNull().default(0),
},t=>[index('referral_notices_lead_idx').on(t.leadId)]);

export const monthlyAwards=sqliteTable('monthly_awards',{month:text('month').primaryKey(),payload:text('payload'),finalizedAt:text('finalized_at').notNull()});

export const adminUserViews=sqliteTable('admin_user_views',{
 tokenHash:text('token_hash').primaryKey(),adminTokenHash:text('admin_token_hash').notNull(),userId:text('user_id').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('admin_user_views_session_idx').on(t.adminTokenHash)]);

export const firmClaims=sqliteTable('firm_claims',{
 id:text('id').primaryKey(),firmKey:text('firm_key').notNull(),firmName:text('firm_name').notNull(),userId:text('user_id').notNull(),firmEmail:text('firm_email').notNull(),authority:text('authority').notNull(),status:text('status').notNull().default('pending'),firmEmailVerifiedAt:text('firm_email_verified_at'),emailTokenHash:text('email_token_hash').notNull().default(''),emailTokenExpires:integer('email_token_expires').notNull().default(0),emailSentAt:integer('email_sent_at').notNull().default(0),reviewNote:text('review_note').notNull().default(''),submittedAt:text('submitted_at').notNull(),reviewedAt:text('reviewed_at'),reviewedBy:text('reviewed_by'),
},t=>[uniqueIndex('firm_claims_user_firm_idx').on(t.userId,t.firmKey),index('firm_claims_status_idx').on(t.status),index('firm_claims_token_idx').on(t.emailTokenHash)]);
export const firmOwners=sqliteTable('firm_owners',{
 firmKey:text('firm_key').primaryKey(),userId:text('user_id').notNull(),claimId:text('claim_id').notNull(),approvedAt:text('approved_at').notNull(),
},t=>[index('firm_owners_user_idx').on(t.userId)]);

export const directoryPageViews=sqliteTable('directory_page_views',{
 eventId:text('event_id').primaryKey(),targetKind:text('target_kind').notNull(),targetKey:text('target_key').notNull(),source:text('source').notNull().default('other'),createdAt:text('created_at').notNull(),
},t=>[index('directory_page_views_target_idx').on(t.targetKind,t.targetKey,t.createdAt),index('directory_page_views_date_idx').on(t.createdAt,t.targetKind),index('directory_page_views_source_date_idx').on(t.targetKind,t.source,t.createdAt,t.targetKey,t.eventId)]);
export const firmMessages=sqliteTable('firm_messages',{
 id:text('id').primaryKey(),firmKey:text('firm_key').notNull(),name:text('name').notNull(),email:text('email').notNull(),phone:text('phone').notNull().default(''),city:text('city').notNull().default(''),message:text('message').notNull(),status:text('status').notNull().default('new'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('firm_messages_firm_idx').on(t.firmKey,t.createdAt)]);

export const accountEmailConfirmations=sqliteTable('account_email_confirmations',{
 userId:text('user_id').primaryKey().references(()=>clientProfiles.userId,{onDelete:'cascade'}),email:text('email').notNull(),verifiedAt:text('verified_at'),tokenHash:text('token_hash').notNull().default(''),expiresAt:integer('expires_at').notNull().default(0),sentAt:integer('sent_at').notNull().default(0),
},t=>[uniqueIndex('account_email_confirmation_token').on(t.tokenHash).where(sql`token_hash<>''`)]);

export const clientEmailChanges=sqliteTable('client_email_changes',{
 userId:text('user_id').primaryKey(),oldEmail:text('old_email').notNull(),newEmail:text('new_email').notNull(),passwordHash:text('password_hash').notNull(),tokenHash:text('token_hash').notNull(),expiresAt:integer('expires_at').notNull(),
});

// Qualifying profile visits are separate from historical total opens.
export const rankingProfileVisits=sqliteTable('ranking_profile_visits',{
 eventId:text('event_id').primaryKey(),targetKind:text('target_kind').notNull(),targetKey:text('target_key').notNull(),visitorKey:text('visitor_key').notNull(),day:text('day').notNull(),createdAt:text('created_at').notNull()
},t=>[uniqueIndex('ranking_visits_visitor_day_idx').on(t.targetKind,t.targetKey,t.visitorKey,t.day),index('ranking_visits_target_date_idx').on(t.targetKind,t.targetKey,t.createdAt),index('ranking_visits_date_idx').on(t.createdAt,t.targetKind)]);

export const searchReferralVisits=sqliteTable('search_referral_visits',{
 eventKey:text('event_key').primaryKey(),source:text('source').notNull(),barNumber:text('bar_number').notNull().default(''),createdAt:text('created_at').notNull()
},t=>[index('search_referral_date').on(t.createdAt),index('search_referral_attorney_idx').on(t.source,t.barNumber,t.createdAt)]);
export const googleFirmArrivals=sqliteTable('google_firm_arrivals',{
 eventKey:text('event_key').primaryKey(),firmKey:text('firm_key').notNull(),firmName:text('firm_name').notNull(),createdAt:text('created_at').notNull()
},t=>[index('google_firm_arrivals_target_idx').on(t.firmKey,t.createdAt)]);

// Full-text virtual tables and synchronization triggers are defined in the
// accompanying schema-only migration; Drizzle does not model FTS5 tables.
export const searchIndexProgress=sqliteTable('search_index_progress',{
 id:integer('id').primaryKey(),attorneyCursor:integer('attorney_cursor').notNull().default(0),firmCursor:integer('firm_cursor').notNull().default(0),ready:integer('ready').notNull().default(0),
});
