export const claimedProfilesFrom="attorney_profiles p JOIN attorneys a ON a.bar_number=p.bar_number LEFT JOIN client_profiles c ON c.user_id=p.owner_id";
export const claimedProfilesWhere="COALESCE(p.owner_id,'')<>'' AND COALESCE(p.claimed_at,'')<>''";
