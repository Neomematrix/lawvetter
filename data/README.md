# Georgia directory import

Source: https://www.gabar.org/member-directory/?state=GA

The user confirmed permission to reuse the directory on October 8, 2026.
`georgia-attorneys.jsonl` contains only public professional fields, with email,
address, firm, and phone visibility matching the source directory settings.
Birth dates, personal mobile numbers, and identifier fields unrelated to bar
membership are discarded. Bar numbers are kept as strings, including leading
zeros and letters. Inactive and deceased records remain labeled with their
source membership status. This is a dated snapshot, not a live status check.

`georgia-import-summary.json` records the completed collection count and status
breakdown. The source page count includes historical records, not just active
attorneys. Unknown practice specialties, biographies, reviews, and ratings are
not invented.

The collector pages through the directory service used by its public search
page. The loader inserts each record with an idempotent upsert keyed by bar
number into the Site's D1 database. Source data is retained here for audit and
recovery, and is not included in the deployed static assets. Loader credentials
are supplied through stdin and never saved in source. The import endpoint
requires ATTORNEY_IMPORT_KEY; deleting that secret closes it to all writes.

## Reconciliation, October 9, 2026

`georgia-roster-audit.json` records a fresh comparison of every record returned
by the directory's Georgia-address filter. `georgia-import-delta.json` contains
the 19 missing records and 28 changed records. Two historical entries absent
from the current filter were retained, not deleted. The live import script
checks every expected bar ID, every imported field in the delta, and Kessler's
initial, full-name, nickname, and family-law searches. Its results are stored
in `georgia-live-audit.json`. No reviews, ownership claims, or searches are reset.

## Website and LinkedIn coverage

Firm websites are inherited by attorney profiles using the same firm-name key.
Only corroborated URLs are published; email domains are discovery hints.
`verified-firm-websites.json` and the manual source files retain evidence.
`firm-website-audit.json` includes every imported published affiliation and
unresolved entries. Failed retrievals are not evidence that no website exists.
Same-named firms such as Morgan & Morgan need further disambiguation; no shared
website was assigned to that ambiguous group. The Bar's visibility flags remain
respected, and hidden affiliations are not reconstructed from email addresses.

`contact-coverage-summary.json` reports actual link coverage. Website and
LinkedIn verification are explicitly incomplete. A missing LinkedIn link means
unverified, not that the attorney or firm has no account. Firm and individual
LinkedIn links are labeled separately.

## Full missing-website search, October 10, 2026

Every one of the 11,917 previously unlinked published firm/organization names
was searched. Failed requests were retried; names without useful results also
received a second search. `firm-web-search-audit.json` retains the per-profile
query, official candidate source URLs, checked date, and resolution status.

`searched-firm-websites.ts` supplies the new website links to the existing firm
and attorney profile views. Existing website overrides, LinkedIn entries,
application data, attorney claims, and directory records
are preserved. New links require publisher-controlled branding and a matching
published directory email domain, phone, city/postcode, or attorney identity.
When host retrieval is blocked, indexed official pages provide that evidence.
Generic names, domain parking, unrelated directories, conflicting destinations,
and insufficiently corroborated sites remain unresolved. Unresolved means
verification is incomplete; it does not mean that the firm has no website.
