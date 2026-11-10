import {verifiedEmployer} from './verified-employers';
import {assertFirmAllowed} from './directory-deletions';
import {verifiedFirmRoster} from '../app/verified-firm-rosters';
import {rawDb} from './raw';
import {firmKey,firmColumn} from '../app/api/attorneys/firm';
export async function directoryFirmName(name:string){
 if(verifiedEmployer(name))throw Error('This employer is not a law firm. An administrator must add this attorney using the appropriate employment type.');
 await assertFirmAllowed(name);const key=firmKey(name);if(!key)return '';const roster=verifiedFirmRoster(key);if(roster)return roster.name;
 const db=rawDb(),existing=await db.prepare('SELECT company AS name FROM attorneys WHERE '+firmColumn()+'=? ORDER BY name COLLATE NOCASE LIMIT 1').bind(key).first<{name:string}>();
 if(existing)return existing.name;
 const approved=await db.prepare("SELECT name FROM directory_submissions WHERE kind='firm' AND status IN ('approved_for_import','published') AND "+firmColumn('name')+'=? ORDER BY reviewed_at DESC LIMIT 1').bind(key).first<{name:string}>();
 return approved?.name||name.trim();
}
