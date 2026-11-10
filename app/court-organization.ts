// Organizational names only; never classify an attorney as a judge from a name.
export function isCourtOrganization(name:string){
 return /\b(?:court|courthouse|judiciary|judicial\s+(?:circuit|district))\s*$/i.test(name.trim());
}
