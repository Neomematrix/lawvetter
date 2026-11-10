import {practiceCategoryId,splitPracticeAreas} from '../app/practice-category';

export async function isJudicialProfile(db:D1Database,bar:string){
 const profile=await db.prepare('SELECT practice_areas FROM attorney_profiles WHERE bar_number=?').bind(bar).first<{practice_areas:string}>();
 return splitPracticeAreas(profile?.practice_areas||'').some(area=>practiceCategoryId(area)==='judge');
}
