"""Offline SQLite load test using public roster data and reproducible synthetic activity.
Never connects to production. Run from the repository root.
"""
import argparse, concurrent.futures, datetime, json, pathlib, random, sqlite3, subprocess, time

ROOT = pathlib.Path(__file__).resolve().parent.parent

def firm_key(name):
    key = name.strip().lower().replace('&', 'and')
    for char in " \t\n\r.,-'’/()":
        key = key.replace(char, '')
    return 'thriftmclemorellc' if key == 'thriftmclemore' else key

def generate(path):
    if path.exists():
        raise SystemExit('Refusing to replace an existing benchmark database.')
    db = sqlite3.connect(path)
    for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
        db.executescript(migration.read_text())
    roster = [json.loads(line) for line in (ROOT / 'data/georgia-attorneys.jsonl').open()]
    lawyers = [(str(r['barNumber']), str(r['barNumber']), r['name'], r.get('company', ''), r.get('city', ''), r['status'], 'https://example.test/public-record', '2026-10-01T00:00:00.000Z') for r in roster]
    db.executemany('INSERT INTO attorneys(bar_number,source_id,name,company,city,status,source_url,imported_at) VALUES(?,?,?,?,?,?,?,?)', lawyers)
    firms = dict((firm_key(r[3]), r[3]) for r in lawyers if r[3].strip())
    targets = lawyers[:6000]
    firm_targets = list(firms.items())[:3000]
    rng = random.Random(1701)
    def stamp(i):
        day = datetime.datetime(2026, 10, 18, tzinfo=datetime.timezone.utc) + datetime.timedelta(days=i % 16, seconds=(i * 71) % 86400)
        return day.isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    db.executemany('INSERT INTO attorney_search_events VALUES(?,?,?)', [('search-'+str(i), targets[i % 2000][0], stamp(i)) for i in range(5000)])
    views = []
    for i in range(60000):
        kind = 'firm' if i % 3 == 0 else 'attorney'
        target = rng.choice(firm_targets)[0] if kind == 'firm' else rng.choice(targets)[0]
        views.append(('view-'+str(i), kind, target, 'google' if i % 4 else 'other', stamp(i)))
    db.executemany('INSERT INTO directory_page_views VALUES(?,?,?,?,?)', views)
    db.executemany('INSERT INTO search_referral_visits VALUES(?,?,?,?)', [('ref-'+str(i), 'google' if i % 5 else 'bing', '' if i % 3 else targets[i % len(targets)][0], stamp(i)) for i in range(18000)])
    db.executemany('INSERT INTO firm_search_events VALUES(?,?,?,?)', [('firm-search-'+str(i), *firm_targets[i % len(firm_targets)], stamp(i)) for i in range(2000)])
    db.executemany('INSERT INTO google_firm_arrivals VALUES(?,?,?,?)', [('firm-google-'+str(i), *firm_targets[i % len(firm_targets)], stamp(i)) for i in range(2000)])
    db.executemany('INSERT INTO firm_settings(key,name,updated_at) VALUES(?,?,?)', [(key, name, 'now') for key, name in firm_targets[:300]])
    db.commit()
    counts = {table: db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for table in ['attorneys','directory_page_views','search_referral_visits','attorney_search_events','firm_search_events','google_firm_arrivals']}
    db.close()
    return counts

def run(path, query, args, limit):
    db = sqlite3.connect(path)
    db.execute('PRAGMA query_only=ON')
    steps = 0
    started = time.perf_counter()
    def progress():
        nonlocal steps
        steps += 10000
        return time.perf_counter() - started > limit
    db.set_progress_handler(progress, 10000)
    result = {}
    try:
        rows = db.execute(query, args).fetchall()
        result = {'status':'ok', 'rows':len(rows)}
    except sqlite3.OperationalError as error:
        result = {'status':'timeout' if 'interrupted' in str(error) else 'error', 'error':str(error)}
    result.update(ms=round((time.perf_counter()-started)*1000, 2), vm_steps=steps)
    db.close()
    return result

parser = argparse.ArgumentParser()
parser.add_argument('--database', type=pathlib.Path, required=True)
parser.add_argument('--generate', action='store_true')
parser.add_argument('--sql', type=pathlib.Path)
parser.add_argument('--seconds', type=float, default=5)
parser.add_argument('--concurrent', type=int, default=1)
parser.add_argument('--max-ms', type=float, help='Fail if any query exceeds this offline wall-time budget.')
options = parser.parse_args()
counts = generate(options.database) if options.generate else None
queries = json.loads(options.sql.read_text() if options.sql else subprocess.check_output(['node', str(ROOT/'scripts/ranking-query-sql.mjs')], text=True))
end = '2026-11-03T03:24:55.573Z'
cases = [('attorneys-week', queries['attorneys'], ('2026-10-27T03:24:55.573Z',end)), ('attorneys-month',queries['attorneys'],('2026-11-01T04:00:00.000Z',end)), ('firms-week',queries['firms'],('2026-10-27T03:24:55.573Z',end)*2), ('firms-month',queries['firms'],('2026-11-01T04:00:00.000Z',end)*2)]
if options.concurrent == 1:
    results = {name:run(options.database,query,args,options.seconds) for name,query,args in cases}
else:
    with concurrent.futures.ThreadPoolExecutor(max_workers=options.concurrent) as pool:
        futures = [(name,pool.submit(run,options.database,query,args,options.seconds)) for name,query,args in cases*options.concurrent]
        results = [{'case':name,**future.result()} for name,future in futures]
print(json.dumps({'fixture_counts':counts,'concurrency':options.concurrent,'results':results}, indent=2))

measured = list(results.values()) if isinstance(results, dict) else results
if any(r['status'] != 'ok' or (options.max_ms is not None and r['ms'] > options.max_ms) for r in measured):
    raise SystemExit(1)
