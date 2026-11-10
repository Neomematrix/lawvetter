// Keep the SQL predicate aligned with isActiveMembership.
export function activeMembershipSQL(alias=''){return "lower(trim("+(alias?alias+'.':'')+"status)) IN ('active','active member in good standing','member in good standing')";}
