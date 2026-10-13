import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('public pages expose indexable metadata and optional Google integrations',async()=>{
 const layout=await source('app/layout.tsx');
 assert.match(layout,/metadataBase:new URL\(SITE_ORIGIN\)/);
 assert.match(layout,/googleBot:\{index:true,follow:true/);
 assert.match(layout,/NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION/);
 assert.match(layout,/<GoogleAnalytics\/>/);
});

test('crawler discovery uses robots, an expanded sitemap, and real destination links',async()=>{
 const [robots,sitemap,discovery]=await Promise.all([source('app/robots.txt/route.ts'),source('app/sitemap.xml/route.ts'),source('app/Discovery.tsx')]);
 assert.match(robots,/Allow: \/\\n/);
 assert.match(robots,/Sitemap:/);
 assert.match(sitemap,/\/find-a-lawyer/);
 assert.match(sitemap,/practiceGuides/);
 assert.match(sitemap,/attorneyPath\(attorney\)/);
 assert.match(discovery,/href=\{attorneyPath\(attorney\)\}/);
 assert.match(discovery,/href=\{'\/practice-areas\/'\+area.id\}/);
});

test('people-first Georgia and personal-injury guides are available at clean URLs',async()=>{
 const [guide,index]=await Promise.all([source('app/practice-guides.ts'),source('app/find-a-lawyer/page.tsx')]);
 assert.match(guide,/'personal-injury'/);
 assert.match(guide,/Questions to ask|questions:/);
 assert.match(guide,/Deadlines vary by claim/);
 assert.match(index,/Find a lawyer in Georgia/);
 assert.match(index,/Verify the professional record/);
});

test('Royal & Cross attorneys share one verified firm roster',async()=>{
 const [rosters,websites]=await Promise.all([source('app/verified-firm-rosters.ts'),source('app/firm-websites.ts')]);
 assert.match(rosters,/name:'Royal & Cross, LLC'/);
 assert.match(rosters,/bars:\['501513','238455','128532'\]/);
 assert.match(rosters,/verifiedFirmForAttorney\(bar:string\).*crossRoster/);
 for(const bar of ['501513','238455','128532'])assert.match(websites,new RegExp('"'+bar+'": "https:\\/\\/crossfamilylaw\\.com\\/"'));
});
