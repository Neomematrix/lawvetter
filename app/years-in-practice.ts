/** Completed admission anniversaries, using the site's Eastern calendar date. */
export function yearsInPracticeLabel(admitted?: string | null, now = new Date()): string | null {
 const value = admitted?.trim();
 const usDate = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 const normalized = usDate ? `${usDate[3]}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}` : value;
 const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
 if (!match) return null;
 const [, y, m, d] = match;
 const year = Number(y), month = Number(m), day = Number(d);
 const date = new Date(Date.UTC(year, month - 1, day));
 if (year < 1800 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
 const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
 const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
 const currentYear = get('year'), currentMonth = get('month'), currentDay = get('day');
 if (year > currentYear || (year === currentYear && (month > currentMonth || (month === currentMonth && day > currentDay)))) return null;
 const years = currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0);
 return years === 0 ? 'Less than 1 year in practice' : `${years} ${years === 1 ? 'year' : 'years'} in practice`;
}
