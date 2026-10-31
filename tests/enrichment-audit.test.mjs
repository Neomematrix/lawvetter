import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAttorney,auditBatch} from '../lib/enrichment/audit.mjs';
test('missing fields require review and never include suggested content', () => {
 const a = auditAttorney({barNumber:'GA-1',name:'Example Lawyer',state:'GA',sourceUrl:'https://example.org'});
 assert.ok(a.missing.includes('photoKey'));
 assert.ok(a.missing.includes('bio'));
 assert.equal(a.reviewRequired,true);
 assert.deepEqual(a.suggestions,[]);
});
test('complete profile does not appear in audit', () => {
 const attorney={barNumber:'GA-1',name:'Example',...Object.fromEntries(['company','city','county','address','zip','phone','email','lawSchool','admitDate'].map(x=>[x,'present']))};
 const profile={bio:'present',practiceAreas:'present',website:'present',photoKey:'present'};
 assert.deepEqual(auditBatch([attorney],{'GA-1':profile}),[]);
});
