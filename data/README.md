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
