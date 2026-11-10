import type {ProfileViewAnalytics} from '../../../db/profile-view-analytics';
export default function Trend({rows}:{rows:ProfileViewAnalytics['trend']}){
 const max=Math.max(1,...rows.flatMap(r=>[r.views]));
 const x=(index:number)=>rows.length===1?685:35+index*650/(rows.length-1);
 const point=(key:'views',i:number)=>`${x(i)},${145-rows[i][key]*120/max}`;
 const current=rows.findIndex(r=>r.inProgress),completed=current<0?rows.length:current;
 return <><div className="sa-legend"><span>Profile views</span></div>
 <svg className="sa-trend" viewBox="0 0 720 180" role="img" aria-label="Daily activity trend in Eastern Time; today's dashed segment is incomplete">
 <title>Profile views by Eastern Time day. Today (in progress) is dashed.</title>
 {[0,.5,1].map(n=><g key={n}><line x1="35" x2="685" y1={145-n*120} y2={145-n*120} stroke="#e2eaf3"/><text x="2" y={149-n*120}>{Math.round(max*n)}</text></g>)}
 {(['views'] as const).map((key,i)=>{const color=['#246ee8','#ff7900','#7fb9e9'][i];return <g key={key}>
 <polyline data-completed-series={key} points={rows.slice(0,completed).map((_,index)=>point(key,index)).join(' ')} fill="none" stroke={color} strokeWidth="3"/>
 {current>=0&&<><polyline data-in-progress-series={key} points={rows.slice(Math.max(0,current-1)).map((_,index)=>point(key,Math.max(0,current-1)+index)).join(' ')} fill="none" stroke={color} strokeWidth="3" strokeDasharray="6 5"/>
 <circle cx={x(current)} cy={145-rows[current][key]*120/max} r="4" fill="#fff" stroke={color} strokeWidth="2"><title>{`Today (in progress): ${'Profile views'}: ${rows[current][key]}`}</title></circle></>}
 </g>;})}
 <text x="35" y="175">{rows.length>1?rows[0]?.day.slice(5):''}</text><text x="685" y="175" textAnchor="end">{current>=0?'Today (in progress)':rows.at(-1)?.day.slice(5)}</text>
 </svg><p className="sa-note sa-reporting-note">Daily activity in Eastern Time (America/New_York). <span className="sa-incomplete-key">Dashed = today’s incomplete data.</span></p>
 </>;
}
