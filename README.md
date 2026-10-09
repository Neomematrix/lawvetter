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
- `npm test`: build the starter and verify its rendered loading skeleton
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
