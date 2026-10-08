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
