export function wordCount(value:string){return value.match(/[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu)?.length||0;}
export const minimumSituationWords=8;
