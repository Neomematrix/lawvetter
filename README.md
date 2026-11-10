# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: run all product, request, SEO and component-rendering tests
- `npm run typecheck`: check TypeScript without generating output
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## Weekly legal news

The owner requested 12 featured stories refreshed weekly, including at least two family-law stories. The live edition is persisted in D1 `news_state`; all previously published articles remain readable at their existing `/news/<slug>` URLs. The homepage and news index show the edition's 12 featured slugs. The sitemap includes the archive. No rebuild is needed for news refreshes.

The linked task must reopen this exact Site with Sites `get_site` and confirm it remains owner-private. Obtain its current service-access token in memory and use it only on this Site in `OAI-Sites-Authorization: Bearer <token>`. Dispatch consumes this service credential; it does not impersonate a user. The shared news endpoint relies on this owner-private platform boundary. If the Site's audience changes, disable unattended news writes until dedicated writer authorization is implemented. Never put tokens in source, command arguments, files, or task prompts.

Read GET `/api/news` for `{articles,featured,updatedAt}`. Public news research needs no private connector: browse official courts, legislatures and government agencies (DOJ, FTC, EEOC, ACF; cover domestic U.S. cases and legal developments nationwide, not just Georgia; exclude foreign and cross-border developments from the featured set). Verify article publication dates and current case status. Write original, attributed summaries; do not copy third-party articles or invent photos. Distinguish allegations, rulings, settlements and future-effective policy changes. Keep existing accurate stories if too few verified new stories are available; never invent a quota filler.

PUT `/api/news` with `{articles,featured,expectedUpdatedAt}`. Include every existing article, append new articles or factual corrections, exactly 12 distinct featured slugs, and at least two featured articles with `familyLaw:true`. `expectedUpdatedAt` is the last GET's timestamp or null on first initialization. Each article includes string fields `slug,amount,amountLabel,topic,date,sourceDate,title,summary,url,sourceName,status,publishedAt`, booleans `familyLaw` and `usaOnly` (all featured stories must have `usaOnly:true`), and `sections:[{heading,text}]` (2–12). Use HTTPS sources, YYYY-MM-DD source dates, original publication timestamps, and stable lowercase hyphenated slugs. For nonmonetary stories use a brief fact such as `New ruling` with an accurate `amountLabel`, never a fabricated dollar amount.

Read GET after PUT and verify the returned timestamp, 12 featured stories, two-family-law minimum, and preservation of prior slugs. On 409, read fresh and merge before retrying. On a transient failure, read back before retrying to avoid duplicate changes. Do not report success without readback. The initial seeded edition has 14 readable articles and 12 featured articles including two sourced child-support policy stories.

## Verified client reviews

Attorney profiles link to `/client-reviews?bar=...`. Clients use their LawVetter email/password account and create a private, immutable legal-name profile without providing a case number. A docket is required only when requesting verification for a specific attorney. Account creation and knowledge of a public docket are **not** identity verification.

The owner queue is `/admin/client-reviews` (also linked from the attorney account administration links). Access uses the existing `CLAIM_ADMIN_EMAIL` server-side check. The owner manually checks an official court record, matches the submitted full name to the client party, and confirms that the selected attorney represented that party. Record an official case-page URL plus private name-match and representation evidence notes. This is a court-record match, not independent authentication of the account holder. Do not store government identification numbers, ID copies, session tokens or confidential court documents in notes. Unavailable, sealed or ambiguous records remain unapproved. Owner self-approval is prohibited.

There is **no automated Tyler connection or identity-verification provider**. The supplied portal login link does not provide API authorization. Manual approval is the operational requirement; do not describe the feature as automatic verification or guaranteed fraud prevention. The Site audience remains owner-private, so external clients cannot use it until the owner explicitly changes access through a separate publishing/access request.

D1 stores client profiles, relationship requests, review text and verification decision audit entries. Reviews are bound to authenticated user plus attorney. The API authorizes publication only for approved relationships, defaults to anonymous, and requires explicit publication consent. Public review reads return only author (verified legal name or Anonymous), body and publication date. They never return account IDs, email, court, docket, source URL or verification evidence. User-authored text can still disclose identity; the editor warns clients not to include identifying/confidential information. Named attribution uses the name checked during verification, not a later user-supplied display name.

Clients may edit or withdraw their own review. Revocation hides published reviews immediately and blocks further publication. Approval applies only to the attorney-client relationship, not the truth or quality of the review. Attorney profile owners cannot access client verification records or approve reviews. No real client records or sample reviews are seeded.

Verification: `node --experimental-vm-modules --test --test-name-pattern='Client passwords|Existing profiles|Approval email' tests/product.test.mjs` covers password registration/login, migration, session expiry/logout, throttling, authorization, review gating and email delivery states against real SQLite migrations.

### Client account fields and email identity

Client registration collects first name, last name, email and password; it does not collect a case number. Unique normalized emails link to stable profile IDs. Existing platform profiles require the original signed-in platform identity to set their first password; typed email cannot take over an existing profile. Registration does not verify ownership of a newly typed email or establish client identity. Case details are collected for an attorney-specific review request, and manual owner approval remains mandatory.

Passwords use salted scrypt (N=32768, r=8, p=3); only hashes are stored. Opaque 7-day client sessions use Secure/HttpOnly/SameSite cookies, with hashed tokens in D1. Logout invalidates the session server-side. Password changes require the existing password and revoke all older sessions. Login has persistent email/IP rate limits. Password-reset code is implemented; sending requires the server-side RESEND_API_KEY and uses LawVetter <no-reply@lawvetter.com> (the domain must be verified in Resend). Recovery pages are /forgot-password and /reset-password. Tokens expire after 30 minutes and successful resets revoke existing client sessions. Resend failures invalidate the undelivered token and are logged server-side; the public response stays neutral to protect account privacy. Email address ownership verification is not implemented. Client login does not grant admin access: admin pages and APIs still require the platform-authenticated owner. Site hosting remains owner-private; changing that audience is a separate user-authorized step before external customers can use it.

Owner alerts and client decision emails are transactionally queued through Resend using server-side `RESEND_API_KEY`, `APPROVAL_EMAIL_FROM`, and `CLAIM_ADMIN_EMAIL`. Per the configured manual-review workflow, owner emails include submitted full name, account email, attorney and bar number, law firm, docket, state, county, court, other party name, party role, representation dates, and client notes. Accept/Reject links open the signed-in queue for that specific request; no email link mutates a decision. The owner checks name/court/representation evidence, then accepts or rejects with a note. Accepted clients receive a congratulations email naming the attorney and linking to their account; rejected clients receive the reason and a link to correct/resubmit. Provider acceptance is shown separately from confirmed inbox delivery. Stable idempotency keys and frozen payloads protect retries. Existing approval-outbox records are preserved, and a schema-only migration adds a rejection outbox and case detail columns.

Client requests collect full legal name, docket number, county, state/territory, court, and Plaintiff/Defendant role, with optional other party name, file date, representation dates, and notes. The request form separates First name and Last name and stores the joined full name with the existing relationship record. The removed supporting-document name field remains in storage only to preserve older data. Existing requests are preserved and may have blank new fields. No court-data API or paid identity service is used. Accepted attorney relationships persist under the existing user ID and appear in the My attorneys roster; each approved relationship unlocks only that user's review of that attorney. Pending and rejected relationships remain locked. Public review endpoints exclude the private submission details.

## Validation scope

The rendering tests exercise the real LawVetter hero with React server rendering; they do not import a Cloudflare Worker into plain Node. Full Worker and browser integration tests remain a separate staging check. Ranking ties use consecutive positions with alphabetical ordering, matching the displayed methodology. Shortlists require a LawVetter client session rather than platform identity headers.

Clients can complete or revise their own pending requests using the Complete or update case details action. Older incomplete requests automatically show the details form when selected. Updates preserve the request ID and create a new administrator notification; older unsent notifications are superseded. Only pending requests can be updated, and failed sends for the newest revision are recoverable even if an older notification was accepted.


## Owner administration

`/admin` and `/admin-login` use the configured `CLAIM_ADMIN_EMAIL`, with no public administrator registration. Login requires a scrypt password followed by a six-digit email code sent through the existing Resend configuration. Codes expire after ten minutes, allow five attempts, and are consumed atomically. Session credentials are random, stored hashed, and issued only through Secure, HttpOnly, SameSite=Strict cookies. Sessions expire after two hours or twenty minutes of inactivity; the new migration invalidates older sessions. Password resets revoke all sessions and pending codes. Administrator pages disable caching, indexing, referrer sharing, and framing. Unsafe cookie-authenticated API requests require an exact same-origin Origin header.

The owner workspace includes database counts, daily/weekly/monthly/yearly unique-browser totals, a fourteen-day chart, oldest-first review and verification queues, existing claim/submission/inquiry screens, and paginated attorney/firm/client search and editing. Attorney edits preserve ownership. Client edits revoke sessions and reset links. Record writes append an owner audit entry.

XLSX/CSV upload runs in the browser, supports column mapping and a server-validated preview, then saves batches of up to 100 rows. State plus license identifies duplicates; GA numeric licenses retain six-digit padding. Blank cells preserve existing fields, photos and ownership. Imported HTTPS photo URLs redirect through the photo endpoint without server-side fetching. Store spreadsheet license columns as text. Failed batches/rows are reported; already saved rows can be retried without creating duplicates. Imports require an explicit official-record review confirmation. Missing licensing status is marked not independently verified.

Visitor counts begin with this version and exclude administrator sessions, detected bots, and privacy opt-outs. Identifiers reset monthly; year/week/month totals may count a browser again after its identifier resets. These are browser counts, not a census of people. Existing Google Analytics integration requires an actual `NEXT_PUBLIC_GA_MEASUREMENT_ID`; there is currently no configured Google Analytics ID in the runtime environment. No historical daily counts are fabricated.

Validation: product/security tests exercise D1 through SQLite and mocked email delivery. They do not establish real inbox delivery or visual browser behavior. A managed browser controller was unavailable during this update.


### Google Authenticator and admin edit corrections

`/admin/security` provides owner-only QR enrollment. The owner re-enters the password, scans the locally generated QR, and confirms a six-digit TOTP code before email login changes to Authenticator. TOTP follows RFC 6238 with SHA1, 30-second steps, a one-step clock tolerance, and replay prevention. Shared secrets are AES-256-GCM encrypted using the separate secret runtime key `ADMIN_MFA_ENCRYPTION_KEY`, with the owner email authenticated as associated data. Never replace this key while enrolled accounts exist. Setup expires after ten minutes. Ten random, hashed, single-use recovery codes are displayed once. Enrollment revokes other sessions and outstanding login challenges; password reset preserves MFA, and enabled accounts cannot fall back to email login. Keep the owner's Authenticator and recovery codes available for account recovery.

The Edit action opens a native dialog with keyboard focus containment, visible errors, a save action, and a public-profile link. Admin edits preserve ownership and stored biography, website, practice areas, and photo fields are public even when unclaimed; editing does not grant a claimed badge. Owner-edited firm affiliations and explicit contact clears take priority over bundled historical display overrides. Firm website updates are shown on both public firm and attorney pages. Empty import cells continue to preserve data; explicit edits can clear fields.

Import mappings show plain destination labels, recognize annotated headers such as `company (law firm name)`, disallow selecting the same destination twice, and support `profile_photo_filename` through matching JPEG/PNG uploads. The weekly rotating cards now use the rounded gradient panels and raised blue edges of the shortlist cards. Explicit Bing, Applebot, and Applebot-Extended robots groups allow public pages and exclude admin, API, account and recovery pages; permission does not guarantee crawling, indexing or inclusion in AI training.


Spreadsheet import accepts matching state prefixes such as FL-123473 and FL:123473, normalizes them to the plain license number before duplicate matching, and rejects conflicting prefixes. Validation errors identify the Excel row and specific field. The admin overview links directly to Authenticator QR setup; setup uses locally generated SVG QR images with a four-module quiet zone. Ranking badges retain the original orange color.

Public name and practice searches now start with All statuses, so imported records whose supplied status says Member in Good Standing remain discoverable without inventing active eligibility. The Active and Other statuses filters remain available.


## October 13 form and directory update

Admin record editing uses a centered, scrollable native dialog and supports JPEG/PNG photos up to 3 MB. Record changes and uploaded photos persist through the existing protected APIs and appear on public profiles. Excel import extracts modern in-cell photos and row-anchored images, maps their physical worksheet row/column to the selected photo column, previews them, and uploads them after each attorney record is saved. External image links are never fetched by the extractor. Card labels use first and last names while profile pages retain the full legal name. Placeholder portraits use the existing icon; chart rank accents stay orange.

Cloudflare Turnstile is available for contact inquiries, directory/profile submissions, client/attorney registration and login, and password reset. Create a Managed widget for the deployed hostname and set production `TURNSTILE_SITE_KEY` and secret `TURNSTILE_SECRET_KEY`. Both keys are required to activate verification. Admin Security shows its actual configuration status. Partial configuration fails closed. Tokens are checked on the server against hostname and form action; used/expired tokens are rejected by Siteverify and widgets reset after submission attempts. No test keys are deployed. Unconfigured forms retain their rate limits and validation. CAPTCHA is separate from administrator Google Authenticator.

Public contact, listing and account identity fields reject HTML/scripts, control characters and incorrect types. Database values remain bound parameters, including apostrophes and SQL-like text. Request size, origin, consent, photo signature and safe URL checks remain enforced.


The contact inquiry form suggests complete city/state pairs after two typed characters using `/api/cities?format=locations`; identical city names remain distinguishable by state. It accepts manual city/state entry when suggestions are unavailable or the locality is not listed. Suggestion requests are debounced and stale requests are cancelled. Situation descriptions require at least eight words on both the client and server, with a visible live count; punctuation alone does not count as a word.

Attorney cards keep text and actions within the card width with consistent side padding and wrapping. Contact form and confirmation copy use direct wording without hyphenated follow up phrasing.

Profile pages use matching rounded blue-bordered panels, a larger portrait, and a practice area panel at the upper right of the identity. On narrow screens, practice areas move below the identity. Practice-only data no longer produces a second lower profile panel.


## Automatic practice directories

Saving practice areas on a published attorney profile automatically supplies matching practice tiles, linked categories, category pages, intake options, and sitemap entries. Separate multiple areas with commas, semicolons, vertical bars, or newlines. Categories use normalized identifiers so case and punctuation differences do not create duplicate tiles. Each attorney appears in every selected category; matching uses complete category tokens, not substrings. Existing sourced classifications remain available unless an owner edit replaces them. Pending submissions do not contribute categories until approved and published.

Category pages list attorneys with pagination and city/state and exact 5 digit ZIP filters. ZIP+4 records match their first five digits. Empty and unknown categories, invalid ZIP codes, and unrelated partial practice names are handled without broadening the results. Practice area links sit in the upper right profile panel, and a practice-only lower pane is omitted.

The Add lawyer / Add firm submission page uses matching rounded blue-bordered panels, an orange form accent, clear field outlines, accessible focus states, and raised type selector buttons.


## Required verification and submission visibility

Production enables `DIRECTORY_CAPTCHA_REQUIRED=true`. Directory/profile submissions and contact inquiries fail closed when the CAPTCHA provider is unconfigured, incomplete, unavailable, or rejects the token. The Add listing page displays a human verification panel and keeps submission disabled until verification passes. Configure the real `TURNSTILE_SITE_KEY` and secret `TURNSTILE_SECRET_KEY` for the deployed hostname to resume public submissions; no dummy CAPTCHA credentials are used. Administrator login, review actions, and spreadsheet imports remain available for site management.

The admin overview includes a directory submission count, attention link, and a table of pending submissions followed by recent published/rejected records. Its pending count includes pending and approved-for-import records only. The overview and submission review page refresh every 30 seconds while visible and on window focus. Background refresh preserves open review notes and selections. Pending submissions are ordered oldest first; published listings remain visible as history.

Canonical lawyer profile routing compares decoded URL segments so state-qualified IDs such as `CA:264554` do not redirect to the same encoded URL repeatedly. Both raw and encoded route parameters resolve to the existing attorney; renamed slugs redirect once, and malformed encoding is treated as an invalid profile.

Turnstile production credentials are configured through runtime variables. The secret is stored as a secret and is never included in client code. The public privacy notice references Cloudflare’s Turnstile Privacy Addendum, including background verification.
