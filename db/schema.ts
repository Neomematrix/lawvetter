import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
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
