export const referralUrgencies=[
 {value:'routine',label:'No immediate deadline'},
 {value:'soon',label:'Within a week'},
 {value:'urgent',label:'Urgent'},
] as const;
export function referralUrgencyLabel(value:string){return referralUrgencies.find(u=>u.value===value)?.label||'No immediate deadline';}
