import type { HebcalResponse, HolidayInfo } from './types';

// ===== Shabbat Times =====

export interface ShabbatTimes {
  candleLighting: string; // HH:MM Jerusalem local time
  havdalah: string;       // HH:MM Jerusalem local time
}

const shabbatCache = new Map<string, ShabbatTimes>();

export async function fetchShabbatTimes(fridayDateStr: string): Promise<ShabbatTimes | null> {
  if (shabbatCache.has(fridayDateStr)) return shabbatCache.get(fridayDateStr)!;

  const [year, month, day] = fridayDateStr.split('-');
  const url = `https://www.hebcal.com/shabbat?cfg=json&geo=pos&latitude=31.716&longitude=35.112&tzid=Asia%2FJerusalem&M=on&gy=${year}&gm=${month}&gd=${day}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HebCal error: ${res.status}`);
    const data = await res.json();

    let candleLighting = '';
    let havdalah = '';

    for (const item of data.items ?? []) {
      if (item.category === 'candles' && !candleLighting) {
        candleLighting = (item.date as string).slice(11, 16);
      }
      if (item.category === 'havdalah' && !havdalah) {
        havdalah = (item.date as string).slice(11, 16);
      }
    }

    if (!candleLighting && !havdalah) return null;

    const result: ShabbatTimes = { candleLighting, havdalah };
    shabbatCache.set(fridayDateStr, result);
    return result;
  } catch (err) {
    console.error('Failed to fetch Shabbat times:', err);
    return null;
  }
}

let cachedHolidays: Map<string, HolidayInfo[]> | null = null;
let cacheYear: number | null = null;

function buildHebcalUrl(year: number): string {
  return `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&year=${year}&month=x&ss=on&mf=on&c=on&geo=pos&latitude=31.716&longitude=35.112&tzid=Asia%2FJerusalem`;
}

export async function fetchHolidays(): Promise<Map<string, HolidayInfo[]>> {
  const currentYear = new Date().getFullYear();

  // Return cache if same year
  if (cachedHolidays && cacheYear === currentYear) {
    return cachedHolidays;
  }

  try {
    const res = await fetch(buildHebcalUrl(currentYear));
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
    cacheYear = currentYear;
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
