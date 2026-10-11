# Large LawVetter datasets

The deployable website source is complete without restoring these files. Four
large audit/source datasets are stored as compressed parts in
`data/large-data-parts/` so the repository can be transferred reliably.

To restore the original files exactly, run:

```bash
node scripts/restore-large-data.mjs
```

The restore helper validates each file's byte length and Git blob SHA before
writing it. The downloadable LawVetter source ZIP also contains the four files
already restored.
