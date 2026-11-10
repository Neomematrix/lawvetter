export const SEARCH_RADII = [-1,5,10,25,50] as const;
export function searchRadius(value:unknown):number {
 const miles=Number(value);
 return SEARCH_RADII.includes(miles as typeof SEARCH_RADII[number])?miles:50;
}
