import type {Attorney} from './GeorgiaDirectory';
import type {PracticeCategory} from './practice-category';
export type RankedAttorney=Attorney&{searches?:number;rank:number;practice_areas?:string;review_average?:number;review_count?:number};
export type RankedFirm={banner_version?:string|null;name:string;firm_key:string;searches:number;rank:number;ownership_verified?:number};
export type DiscoveryData={unavailable?:boolean;loading?:boolean;stale?:boolean;popular?:(Attorney&{rank?:number;practice_areas?:string})[];practiceCategories?:PracticeCategory[];ratedAll?:RankedAttorney[];ratedWeekly?:RankedAttorney[];ratedMonthly?:RankedAttorney[];weekly:RankedAttorney[];monthly:RankedAttorney[];weeklyFirms:RankedFirm[];monthlyFirms:RankedFirm[];statuses:string[];cities:{city:string;attorneys:number}[];monthLabel:string;updated:string};
export type View='discover'|'charts'|'shortlist';
