import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const attorneys = sqliteTable('attorneys', {
 barNumber: text('bar_number').primaryKey(),
 sourceId: text('source_id').notNull(),
 name: text('name').notNull(),
 company: text('company').notNull().default(''),
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
 importedAt: text('imported_at').notNull(),
}, t => [index('attorneys_name_idx').on(t.name), index('attorneys_city_idx').on(t.city), index('attorneys_status_idx').on(t.status)]);

export const attorneySearchEvents = sqliteTable('attorney_search_events', {
 eventId: text('event_id').primaryKey(),
 barNumber: text('bar_number').notNull().references(() => attorneys.barNumber),
 createdAt: text('created_at').notNull(),
}, t => [index('attorney_search_events_date_idx').on(t.createdAt, t.barNumber)]);

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
 status: text('status').notNull().default('pending'),
 reviewNote: text('review_note').notNull().default(''),
 submittedAt: text('submitted_at').notNull(),
 reviewedAt: text('reviewed_at'),
 reviewedBy: text('reviewed_by'),
},t=>[index('claims_status_idx').on(t.status),index('claims_user_idx').on(t.userId)]);
export const attorneyProfiles = sqliteTable('attorney_profiles', {
 barNumber: text('bar_number').primaryKey().references(() => attorneys.barNumber),
 ownerId: text('owner_id').notNull(),
 headline: text('headline').notNull().default(''),
 bio: text('bio').notNull().default(''),
 practiceAreas: text('practice_areas').notNull().default(''),
 website: text('website').notNull().default(''),
 photoKey: text('photo_key').notNull().default(''),
 claimedAt: text('claimed_at').notNull(),
 updatedAt: text('updated_at').notNull(),
},t=>[index('profiles_owner_idx').on(t.ownerId)]);

export const clientLeads = sqliteTable('client_leads', {
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
},t=>[index('leads_created_idx').on(t.createdAt),index('leads_email_created_idx').on(t.email,t.createdAt)]);

export const newsState = sqliteTable('news_state', {
 id: text('id').primaryKey(),
 payload: text('payload').notNull(),
 updatedAt: text('updated_at').notNull(),
});

export const clientProfiles = sqliteTable('client_profiles', {
 userId:text('user_id').primaryKey(),
 firstName:text('first_name').notNull().default(''),
 lastName:text('last_name').notNull().default(''),
 initialDocket:text('initial_docket').notNull().default(''),
 legalName:text('legal_name').notNull(),
 email:text('email').notNull(),
 createdAt:text('created_at').notNull(),
});
export const clientVerifications = sqliteTable('client_verifications', {
 id:text('id').primaryKey(),
 userId:text('user_id').notNull().references(()=>clientProfiles.userId),
 barNumber:text('bar_number').notNull().references(()=>attorneys.barNumber),
 legalName:text('legal_name').notNull(),
 court:text('court').notNull(),
 county:text('county').notNull(),
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
 publicMode:text('public_mode').notNull().default('anonymous'),
 publishedAt:text('published_at'),
 updatedAt:text('updated_at').notNull(),
},t=>[index('client_verification_user_idx').on(t.userId),index('client_verification_status_idx').on(t.status),index('client_verification_bar_idx').on(t.barNumber),index('client_verification_relationship_idx').on(t.relationshipKey)]);
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
