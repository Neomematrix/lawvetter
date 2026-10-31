// Read-only attorney enrichment audit. Never modifies records or fetches external URLs.
export const FIELDS = Object.freeze(['company','city','county','address','zip','phone','email','lawSchool','admitDate']);
export function auditAttorney(attorney, profile = {}) {
  if (!attorney || !attorney.barNumber || !attorney.name) throw new Error('Attorney identifier and name required');
  const missing = FIELDS.filter(field => !String(attorney[field] ?? '').trim());
  for (const field of ['bio','practiceAreas','website','photoKey']) {
    if (!String(profile[field] ?? '').trim()) missing.push(field);
  }
  return {
    barNumber: attorney.barNumber,
    name: attorney.name,
    state: attorney.state || '',
    sourceUrl: attorney.sourceUrl || '',
    missing,
    reviewRequired: true,
    suggestions: [],
  };
}
export function auditBatch(attorneys, profilesByBarNumber = {}) {
  return attorneys.map(a => auditAttorney(a, profilesByBarNumber[a.barNumber] || {}))
    .filter(a => a.missing.length > 0);
}
