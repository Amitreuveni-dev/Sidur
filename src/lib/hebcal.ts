import type { HebcalResponse, HolidayInfo } from './types';

let cachedHolidays: Map<string, HolidayInfo[]> | null = null;
let cacheMonth: number | null = null;

function buildHebcalUrl(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&year=${year}&month=${month}&ss=on&mf=on&c=on&geo=pos&latitude=31.716&longitude=35.112&tzid=Asia%2FJerusalem`;
}

export async function fetchHolidays(): Promise<Map<string, HolidayInfo[]>> {
  const currentMonth = new Date().getMonth();

  // Return cache if same month
  if (cachedHolidays && cacheMonth === currentMonth) {
    return cachedHolidays;
  }

  try {
    const res = await fetch(buildHebcalUrl());
    if (!res.ok) throw new Error(`Hebcal API error: ${res.status}`);

    const data = (await res.json()) as HebcalResponse;
    const map = new Map<string, HolidayInfo[]>();

    for (const item of data.items) {
      if (item.category !== 'holiday' && item.category !== 'roshchodesh') continue;

      const dateKey = item.date.slice(0, 10); // "YYYY-MM-DD"
      const existing = map.get(dateKey) ?? [];
      existing.push({
        name: item.title,
        hebrew: item.hebrew ?? item.title,
        isYomTov: item.yomtov === true,
      });
      map.set(dateKey, existing);
    }

    cachedHolidays = map;
    cacheMonth = currentMonth;
    return map;
  } catch (err) {
    console.error('Failed to fetch Hebcal data:', err);
    return new Map();
  }
}

/**
 * Check if a given date is erev chag by looking at the next day.
 * If the next day has a yomTov holiday, this day is erev chag.
 */
export function isErevChag(
  dateStr: string,
  holidays: Map<string, HolidayInfo[]>
): boolean {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  const nextDay = date.toISOString().slice(0, 10);
  const nextHolidays = holidays.get(nextDay);
  if (!nextHolidays) return false;
  return nextHolidays.some((h) => h.isYomTov);
}

/**
 * Get holidays for a specific date.
 */
export function getHolidaysForDate(
  dateStr: string,
  holidays: Map<string, HolidayInfo[]>
): HolidayInfo[] {
  return holidays.get(dateStr) ?? [];
}
