export const RETIRED = 'Retired';
export const GOOD_STANDING = 'Member in Good Standing';
export const membershipStatuses = [GOOD_STANDING,'Active'];
export function membershipStatus(value:string|undefined|null):string {
 const status=(value||'').trim().replace(/\s+/g,' ');
 return /^(?:active )?member in good standing$/i.test(status)?GOOD_STANDING:status;
}
export function validatedMembershipStatus(value:string,allowRetired=false):string {
 const status=membershipStatus(value);
 if(allowRetired&&status.toLowerCase()===RETIRED.toLowerCase())return RETIRED;
 const match=membershipStatuses.find(option=>option.toLowerCase()===status.toLowerCase());
 if(!match)throw Error('Choose a membership status from the provided options.');
 return match;
}

// Exact accepted registry statuses. Inactive good standing is never active.
export function isActiveMembership(value:string|undefined|null):boolean {
 return /^(?:active|(?:active )?member in good standing)$/i.test((value||'').trim().replace(/\s+/g,' '));
}
