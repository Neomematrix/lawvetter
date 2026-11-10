// Only approved, currently owned profiles receive the public ownership badge.
export function ownershipVerifiedColumn(alias='attorneys') {
 return `EXISTS(SELECT 1 FROM attorney_profiles verified WHERE verified.bar_number=${alias}.bar_number AND verified.owner_id<>'' AND verified.claimed_at<>'') AS ownership_verified`;
}
