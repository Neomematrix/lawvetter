import {rawDb} from '../../db/raw';
import {settlements} from './stories';
import {familyStories} from './family-stories';
import type {NewsEdition,NewsStory} from './types';
export const seedArticles:NewsStory[]=[...familyStories,...settlements];
export const seedEdition:NewsEdition={articles:seedArticles,featured:[...familyStories,...settlements.slice(0,10)].sort((a,b)=>b.sourceDate.localeCompare(a.sourceDate)).map(a=>a.slug),updatedAt:null};
export async function readNews():Promise<NewsEdition>{
 const row=await rawDb().prepare("SELECT payload,updated_at FROM news_state WHERE id='current'").first<{payload:string;updated_at:string}>();
 return row?{...JSON.parse(row.payload),updatedAt:row.updated_at}:seedEdition;
}
export function featuredNews(edition:NewsEdition){const map=new Map(edition.articles.map(a=>[a.slug,a]));return edition.featured.map(s=>map.get(s)!).filter(Boolean);}
