import { PublicHoliday } from '../types/hrms';

/**
 * Anonymous Gregorian algorithm to compute Western Easter for any given year
 */
function getEasterDates(year: number): { goodFriday: string; easterMonday: string } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);

  const gf = new Date(easter);
  gf.setDate(easter.getDate() - 2);

  const em = new Date(easter);
  em.setDate(easter.getDate() + 1);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  return {
    goodFriday: format(gf),
    easterMonday: format(em)
  };
}

/**
 * Returns the official pre-loaded Kenyan Public Holidays for a specific year
 * Including: New Year, Labour Day, Madaraka Day, Utamaduni Day, Mashujaa Day, 
 * Jamhuri Day, Christmas, Boxing Day, Good Friday, Easter Monday, Eid al-Fitr, Eid al-Adha.
 */
export function getKenyanPublicHolidays(year: number): PublicHoliday[] {
  const { goodFriday, easterMonday } = getEasterDates(year);

  // Approximate Islamic dates for Kenya gazetted holidays
  const eidDates: Record<number, { fitr: string; adha: string }> = {
    2024: { fitr: '2024-04-11', adha: '2024-06-17' },
    2025: { fitr: '2025-03-31', adha: '2025-06-06' },
    2026: { fitr: '2026-03-20', adha: '2026-05-27' },
    2027: { fitr: '2027-03-10', adha: '2027-05-16' }
  };

  const currentEid = eidDates[year] || {
    fitr: `${year}-03-20`,
    adha: `${year}-05-27`
  };

  return [
    { id: `ke-${year}-new-year`, name: "New Year's Day", date: `${year}-01-01` },
    { id: `ke-${year}-eid-al-fitr`, name: 'Eid al-Fitr', date: currentEid.fitr },
    { id: `ke-${year}-good-friday`, name: 'Good Friday', date: goodFriday },
    { id: `ke-${year}-easter-monday`, name: 'Easter Monday', date: easterMonday },
    { id: `ke-${year}-labour-day`, name: 'Labour Day', date: `${year}-05-01` },
    { id: `ke-${year}-eid-al-adha`, name: 'Eid al-Adha', date: currentEid.adha },
    { id: `ke-${year}-madaraka-day`, name: 'Madaraka Day', date: `${year}-06-01` },
    { id: `ke-${year}-utamaduni-day`, name: 'Utamaduni / Mazingira Day', date: `${year}-10-10` },
    { id: `ke-${year}-mashujaa-day`, name: 'Mashujaa Day', date: `${year}-10-20` },
    { id: `ke-${year}-jamhuri-day`, name: 'Jamhuri Day', date: `${year}-12-12` },
    { id: `ke-${year}-christmas`, name: 'Christmas Day', date: `${year}-12-25` },
    { id: `ke-${year}-boxing-day`, name: 'Boxing Day', date: `${year}-12-26` }
  ];
}

/**
 * Returns the wage multiplier based on attendance status:
 * - full day, approved leave, paid holiday = 1.0
 * - half day = 0.5
 * - absent = 0
 */
export function getDayMultiplier(status: string): number {
  switch (status) {
    case 'present_full':
    case 'present':
    case 'approved_leave':
    case 'holiday':
    case 'leave':
      return 1.0;
    case 'present_half':
      return 0.5;
    case 'absent':
    default:
      return 0;
  }
}

export function formatAttendanceStatus(status: string): { label: string; color: string; bg: string } {
  switch (status) {
    case 'present_full':
    case 'present':
      return { label: 'Present (Full Day)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    case 'present_half':
      return { label: 'Half Day (0.5x)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    case 'approved_leave':
    case 'leave':
      return { label: 'Approved Leave', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
    case 'holiday':
      return { label: 'Paid Holiday', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    case 'absent':
    default:
      return { label: 'Absent', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' };
  }
}

/**
 * Combines built-in Kenyan holidays with custom holidays and excludes removed ones
 */
export function getAllHolidays(
  year: number, 
  customHolidays: PublicHoliday[] = [], 
  removedIds: string[] = []
): PublicHoliday[] {
  const base = getKenyanPublicHolidays(year);
  const activeBase = base.filter(h => !removedIds.includes(h.id));
  const activeCustom = customHolidays.filter(h => {
    return h.date.startsWith(`${year}`) && !removedIds.includes(h.id);
  });

  return [...activeBase, ...activeCustom].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns ISO week string identifier, e.g. "2026-W38"
 */
export function getWeekId(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : new Date(dateInput);
  // Target date
  const target = new Date(d.valueOf());
  // ISO week date weeks start on Monday, so correct the day number
  const dayNr = (d.getDay() + 6) % 7;
  // Set target to Thursday of this week so the year of the week matches ISO
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Returns the Monday to Sunday date strings (YYYY-MM-DD) for a given week containing the date
 */
export function getWeekDates(dateInput: string | Date): { date: string; dayName: string; dayIndex: number }[] {
  const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : new Date(dateInput);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (day + 6) % 7;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDates: { date: string; dayName: string; dayIndex: number }[] = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const y = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    weekDates.push({
      date: `${y}-${mm}-${dd}`,
      dayName: dayNames[i],
      dayIndex: i
    });
  }

  return weekDates;
}

/**
 * Formats a week range, e.g. "Mon 15 Sep – Sat 20 Sep 2026"
 */
export function formatWeekRange(dates: { date: string }[]): string {
  if (!dates.length) return '';
  const start = new Date(dates[0].date + 'T00:00:00');
  const end = new Date(dates[dates.length - 1].date + 'T00:00:00');

  const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export const DEFAULT_WORK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isWorkingDay(dateStr: string, workDays: string[] = DEFAULT_WORK_DAYS): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const name = dayNames[d.getDay()];
  return workDays.includes(name);
}

export function findHoliday(dateStr: string, holidays: PublicHoliday[]): PublicHoliday | undefined {
  return holidays.find(h => h.date === dateStr);
}
