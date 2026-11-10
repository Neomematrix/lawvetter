export default function VerifiedOwnershipBadge({compact=true}:{compact?:boolean}={}) {
  return <span className={'verified-ownership-badge'+(compact?' verified-ownership-compact':'')} title="This attorney’s identity has been verified by LawVetter.">
    <span className="verified-ownership-mark" aria-hidden="true">
      <img src="/brand/lawvetter-icon.svg" alt="" width="44" height="36" />
      <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="currentColor" stroke="white" strokeWidth="2" /><path d="m6 10 3 3 5-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
    <span><strong>Verified</strong></span>
  </span>;
}
