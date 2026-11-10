'use client';
import {lazy,use,type ComponentType} from 'react';
import type {Attorney} from './GeorgiaDirectory';
import type {DiscoveryData,View} from './Discovery';

export type InitialDiscoveryData=DiscoveryData|null|Promise<DiscoveryData|null>;
export type DirectoryViewProps={data:DiscoveryData;onOpen:(a:Attorney)=>void;onView:(v:View)=>void;onPractice:(id:string)=>void};
export type DirectoryViewComponent=ComponentType<DirectoryViewProps>;
// Only navigation to another view loads that view's implementation. The server
// supplies the initial component reference so initial HTML never waits for an
// import from a client effect or substitutes a client-only loading screen.
const views:Record<View,DirectoryViewComponent>={
 discover:lazy(()=>import('./DiscoveryHome').then(module=>({default:module.DiscoveryHome}))),
 charts:lazy(()=>import('./Charts').then(module=>({default:module.Charts}))),
 shortlist:lazy(()=>import('./ShortlistPage').then(module=>({default:module.ShortlistPage}))),
};
export default function DirectoryContent({view,initialView,initialComponent,data,pending=false,...actions}:{view:View;initialView:View;initialComponent?:DirectoryViewComponent;data:InitialDiscoveryData;pending?:boolean}&Omit<DirectoryViewProps,'data'>){
 const resolved=data&&'then' in data?use(data):data;
 const Component=view===initialView&&initialComponent?initialComponent:views[view];
 const available=resolved||(view==='discover'?{unavailable:true,loading:pending,weekly:[],monthly:[],weeklyFirms:[],monthlyFirms:[],statuses:[],cities:[],monthLabel:'',updated:''}:null);
 return available||view==='shortlist'?<><Component {...actions} data={available!}/></>:<div className="chart-empty" role="alert"><div><h2>We couldn’t load this section.</h2><p>Please try again. You can still use the attorney search above.</p><button type="button" className="outline-button" onClick={()=>window.location.reload()}>Try again</button></div></div>;
}
