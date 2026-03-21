/**
 * Converts a weekId (e.g. "2026-W17") into a Hebrew date-range label.
 *
 * Examples:
 *   "2026-W21" -> "שבוע 17–23 במאי 2026"
 *   "2026-W18" -> "שבוע 28 באפריל – 4 במאי 2026"
 *
 * The internal weekId format is never changed — this is display-only.
 */

const HEBREW_MONTHS: readonly string[] = [
  'ינואר',    // 0 = January
  'פברואר',   // 1
  'מרץ',      // 2
  'אפריל',    // 3
  'מאי',      // 4
  'יוני',     // 5
  'יולי',     // 6
  'אוגוסט',   // 7
  'ספטמבר',   // 8
  'אוקטובר',  // 9
  'נובמבר',   // 10
  'דצמבר',    // 11
];

/**
 * Returns the 7 dates (Sunday–Saturday, Israel-style) for a given ISO weekId.
 * Mirrors the logic in WeekTimeline.tsx.
 */
function getWeekDates(weekId: string): Date[] {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return [];

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO 8601: Week 1 contains January 4th
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Move to the target week's Monday
  monday.setDate(monday.getDate() + (week - 1) * 7);

  // Israel weeks start on Sunday — go back 1 day
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Formats a weekId into a Hebrew date-range string for display.
 */
export function formatWeekLabel(weekId: string): string {
  const dates = getWeekDates(weekId);
  if (dates.length === 0) return weekId; // fallback to raw ID

  const first = dates[0];
  const last = dates[dates.length - 1];

  const firstDay = first.getDate();
  const lastDay = last.getDate();
  const firstMonth = first.getMonth();
  const lastMonth = last.getMonth();
  const firstYear = first.getFullYear();
  const lastYear = last.getFullYear();

  // Same month & year — "שבוע 17–23 במאי 2026"
  if (firstMonth === lastMonth && firstYear === lastYear) {
    return `שבוע ${firstDay}–${lastDay} ב${HEBREW_MONTHS[firstMonth]} ${firstYear}`;
  }

  // Different months but same year — "שבוע 28 באפריל – 4 במאי 2026"
  if (firstYear === lastYear) {
    return `שבוע ${firstDay} ב${HEBREW_MONTHS[firstMonth]} – ${lastDay} ב${HEBREW_MONTHS[lastMonth]} ${firstYear}`;
  }

  // Different years (rare, Dec→Jan) — "שבוע 29 בדצמבר 2025 – 4 בינואר 2026"
  return `שבוע ${firstDay} ב${HEBREW_MONTHS[firstMonth]} ${firstYear} – ${lastDay} ב${HEBREW_MONTHS[lastMonth]} ${lastYear}`;
}
