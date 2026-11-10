export default function ProfessionalWorkspaceSwitch({active}:{active:'firm'|'attorney'}){
 return <nav className="professional-workspace-switch" aria-label="Switch professional workspace"><a href="/client-reviews" aria-current={active==='firm'?'page':undefined}><span>Firm account</span><small>Team, firm profile & inbox</small></a><a href="/account" aria-current={active==='attorney'?'page':undefined}><span>My lawyer account</span><small>Profile, analytics & inbox</small></a></nav>;
}
