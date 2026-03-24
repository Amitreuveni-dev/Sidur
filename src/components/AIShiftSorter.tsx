'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmployees, saveShift } from '@/lib/storage';
import { fetchShabbatTimes } from '@/lib/hebcal';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import type { Employee } from '@/lib/types';

// Minutes to add to Havdalah time for store opening on Motzaei Shabbat
const MOTZAEI_OFFSET_MINUTES = 10;

// Day keyword → index (0 = Sunday … 6 = Saturday)
const DAY_MAP: Record<string, number> = {
  ראשון: 0, sunday: 0, sun: 0,
  שני: 1, monday: 1, mon: 1,
  שלישי: 2, tuesday: 2, tue: 2,
  רביעי: 3, wednesday: 3, wed: 3,
  חמישי: 4, thursday: 4, thu: 4,
  שישי: 5, friday: 5, fri: 5, // → will be rejected
  שבת: 6, saturday: 6, sat: 6,
};

// Shift-type keyword → times
const SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  בוקר: { start: '11:00', end: '17:30' },
  morning: { start: '11:00', end: '17:30' },
  am: { start: '11:00', end: '17:30' },
  ערב: { start: '17:30', end: '23:00' },
  evening: { start: '17:30', end: '23:00' },
  pm: { start: '17:30', end: '23:00' },
  לילה: { start: '17:30', end: '23:00' },
  night: { start: '17:30', end: '23:00' },
};

const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface ParsedShift {
  employeeId: string;
  employeeName: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  note?: string;
}

interface ParseResult {
  shifts: ParsedShift[];
  warnings: string[];
}

function getWeekDates(weekId: string): string[] {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return [];
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

function matchEmployee(name: string, employees: Employee[]): Employee | undefined {
  const n = name.trim().toLowerCase();
  return (
    employees.find((e) => e.name.toLowerCase() === n) ||
    employees.find((e) => e.name.toLowerCase().startsWith(n)) ||
    employees.find((e) => n.startsWith(e.name.toLowerCase())) ||
    employees.find((e) => e.name.toLowerCase().includes(n))
  );
}

// Strips Hebrew gershayim and various quote chars before map lookup.
// This makes מוצ"ש, מוצ״ש, מוצ"ש, מוצש all normalise to מוצש.
function norm(token: string): string {
  return token.replace(/[״""''׳"']/g, '').toLowerCase();
}

// Tokens that mean "Saturday evening" (Motzaei Shabbat) on their own.
const MOTZAEI_TOKENS = new Set(['מוצש', 'motzash']);

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function parseText(
  text: string,
  employees: Employee[],
  weekDates: string[],
  havdalahTime: string | null
): ParseResult {
  const shifts: ParsedShift[] = [];
  const warnings: string[] = [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('#'));

  for (const line of lines) {
    // ── Detect employee name ──────────────────────────────────────────────
    let rawName = '';
    let restLine = line;

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      rawName = line.slice(0, colonIdx).trim();
      restLine = line.slice(colonIdx + 1).trim();
    } else {
      for (const emp of employees) {
        if (line.toLowerCase().startsWith(emp.name.toLowerCase())) {
          rawName = emp.name;
          restLine = line.slice(emp.name.length).trim();
          break;
        }
      }
      if (!rawName) {
        warnings.push(`לא נמצא שם עובד בשורה: "${line}"`);
        continue;
      }
    }

    const employee = matchEmployee(rawName, employees);
    if (!employee) {
      warnings.push(`עובד לא נמצא: "${rawName}" — הוסף אותו קודם בניהול עובדים`);
      continue;
    }

    // ── Token-by-token state machine ──────────────────────────────────────
    // Commas and whitespace are both treated as separators.
    // Works with or without commas between pairs.
    // Handles both "day shift" and "shift day" ordering.
    const tokens = restLine.split(/[\s,،]+/).filter(Boolean);

    let pendingDay: number | null = null;
    let pendingShift: { start: string; end: string } | null = null;

    function commitPair(
      dayIdx: number,
      shiftTime: { start: string; end: string },
      note?: string
    ) {
      if (dayIdx === 5) {
        warnings.push(`⚠️ שישי הוא יום מנוחה! (${employee!.name})`);
        return;
      }
      const date = weekDates[dayIdx];
      if (!date) return;
      shifts.push({
        employeeId: employee!.id,
        employeeName: employee!.name,
        date,
        dayName: HEBREW_DAY_NAMES[dayIdx],
        startTime: shiftTime.start,
        endTime: shiftTime.end,
        note,
      });
    }

    for (const t of tokens) {
      const n = norm(t);

      if (MOTZAEI_TOKENS.has(n)) {
        // Flush any complete pending pair first
        if (pendingDay !== null && pendingShift !== null) {
          commitPair(pendingDay, pendingShift);
        } else if (pendingDay !== null) {
          warnings.push(`לא זוהה סוג משמרת ליום ${HEBREW_DAY_NAMES[pendingDay]}`);
        }
        pendingDay = null;
        pendingShift = null;
        // מוצ"ש = Saturday evening — use real havdalah + offset, or fall back to 17:30
        const motzaeiStart = havdalahTime
          ? addMinutes(havdalahTime, MOTZAEI_OFFSET_MINUTES)
          : '17:30';
        const motzaeiNote = havdalahTime
          ? `פתיחה ${MOTZAEI_OFFSET_MINUTES} דק׳ אחרי צאת שבת (${havdalahTime})`
          : `פתיחה מוצ״ש`;
        commitPair(6, { start: motzaeiStart, end: '23:00' }, motzaeiNote);

      } else if (n in DAY_MAP) {
        if (pendingDay !== null && pendingShift !== null) {
          // Previous pair is complete — flush it
          commitPair(pendingDay, pendingShift);
          pendingDay = null;
          pendingShift = null;
        } else if (pendingDay !== null) {
          // Day without shift type — warn
          warnings.push(`לא זוהה סוג משמרת ליום ${HEBREW_DAY_NAMES[pendingDay]}`);
          pendingDay = null;
        }

        const newDay = DAY_MAP[n];
        if (pendingShift !== null) {
          // Shift-before-day order (e.g. "בוקר שני")
          commitPair(newDay, pendingShift);
          pendingShift = null;
        } else {
          pendingDay = newDay;
        }

      } else if (n in SHIFT_TIMES) {
        if (pendingDay !== null) {
          // Day-before-shift order (normal: "שני בוקר")
          commitPair(pendingDay, SHIFT_TIMES[n]);
          pendingDay = null;
          pendingShift = null;
        } else {
          pendingShift = SHIFT_TIMES[n];
        }
      }
    }

    // Flush anything left after the last token
    if (pendingDay !== null && pendingShift !== null) {
      commitPair(pendingDay, pendingShift);
    } else if (pendingDay !== null) {
      warnings.push(`לא זוהה סוג משמרת ליום ${HEBREW_DAY_NAMES[pendingDay]}`);
    }
  }

  return { shifts, warnings };
}

interface AIShiftSorterProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: string;
  onImported: () => void;
}

export default function AIShiftSorter({
  isOpen,
  onClose,
  weekId,
  onImported,
}: AIShiftSorterProps) {
  useBodyScrollLock(isOpen);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [imported, setImported] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleParse = useCallback(async () => {
    setParsing(true);
    const employees = getEmployees();
    const weekDates = getWeekDates(weekId);
    // Fetch havdalah time for this week (cached after first call)
    const fridayDate = weekDates[5];
    const shabbatTimes = fridayDate ? await fetchShabbatTimes(fridayDate) : null;
    if (!shabbatTimes) {
      // Surface a soft warning but still continue parsing
      setParsed((prev) => {
        const base = parseText(text, employees, weekDates, null);
        base.warnings.unshift('לא הצלחנו למשוך את זמן יציאת שבת — שעת מוצ״ש תהיה 17:30 כברירת מחדל');
        return base;
      });
    } else {
      setParsed(parseText(text, employees, weekDates, shabbatTimes.havdalah));
    }
    setImported(false);
    setParsing(false);
  }, [text, weekId]);

  const handleImport = useCallback(() => {
    if (!parsed || parsed.shifts.length === 0) return;
    for (const s of parsed.shifts) {
      saveShift({
        id: crypto.randomUUID(),
        weekId,
        date: s.date,
        employeeId: s.employeeId,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });
    }
    setImported(true);
    setTimeout(() => {
      onImported();
      onClose();
      setText('');
      setParsed(null);
      setImported(false);
    }, 1200);
  }, [parsed, weekId, onImported, onClose]);

  const handleClose = useCallback(() => {
    onClose();
    setText('');
    setParsed(null);
    setImported(false);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-slate-950/90 flex items-end justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-warm-50 dark:bg-slate-800 rounded-t-3xl max-h-[88vh] flex flex-col"
          >
            {/* Handle + Header */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-warm-200 dark:border-slate-700">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 bg-warm-300 dark:bg-slate-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🤖</span>
                  <span>ייבוא חכם של משמרות</span>
                </h2>
                <button
                  onClick={handleClose}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-warm-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="סגור"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4" style={{ touchAction: 'pan-y' }}>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                הדבק טקסט עם שמות עובדים וימים. לדוגמה:
              </p>
              <div className="bg-warm-100 dark:bg-slate-700/50 rounded-xl p-3 mb-3 text-xs text-slate-600 dark:text-slate-300 font-mono leading-relaxed" dir="rtl">
                <div>יוחאי: ראשון בוקר שני ערב</div>
                <div>שירה: שלישי בוקר חמישי מוצש</div>
                <div className="mt-1 text-slate-400 dark:text-slate-500">
                  Yochai: Sun morning Mon evening
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setParsed(null);
                }}
                placeholder="הדבק כאן את הטקסט..."
                rows={5}
                dir="auto"
                className="w-full bg-warm-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none mb-3"
              />

              <button
                onClick={handleParse}
                disabled={!text.trim() || parsing}
                className="w-full bg-blue-500 text-white font-bold rounded-xl py-2.5 min-h-[44px] hover:bg-blue-600 active:bg-blue-700 active:scale-[0.97] disabled:opacity-40 transition-all duration-150 mb-4"
              >
                {parsing ? '⏳ מושך זמני שבת...' : 'פענח טקסט'}
              </button>

              {/* Preview */}
              {parsed && (
                <div className="flex flex-col gap-3">
                  {/* Warnings */}
                  {parsed.warnings.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-3">
                      <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-2">
                        ⚠️ הערות:
                      </p>
                      <div className="flex flex-col gap-1">
                        {parsed.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-yellow-600 dark:text-yellow-500">
                            {w}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parsed shifts preview */}
                  {parsed.shifts.length > 0 ? (
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        ✓ {parsed.shifts.length} משמרות זוהו:
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {parsed.shifts.map((s, i) => (
                          <div
                            key={i}
                            className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {s.employeeName}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-300">
                                {s.dayName} · {s.startTime}–{s.endTime}
                              </span>
                            </div>
                            {s.note && (
                              <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">
                                {s.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                      לא זוהו משמרות תקינות
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer — import button */}
            {parsed && parsed.shifts.length > 0 && (
              <div className="flex-shrink-0 p-4 border-t border-warm-200 dark:border-slate-700">
                <AnimatePresence mode="wait">
                  {imported ? (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-2 py-3 text-green-500 dark:text-green-400 font-bold"
                    >
                      <span>✓</span>
                      <span>יובאו {parsed.shifts.length} משמרות!</span>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="import"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={handleImport}
                      className="w-full bg-green-600 text-white font-bold rounded-xl py-3 min-h-[44px] hover:bg-green-700 active:bg-green-800 active:scale-[0.97] transition-all duration-150"
                    >
                      ייבא {parsed.shifts.length} משמרות
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
