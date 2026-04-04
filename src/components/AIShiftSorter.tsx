'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getEmployees,
  getShifts,
  saveShift,
  removeShift,
  getShiftSlot,
  findOtherSlotShift,
  getNicknameMap,
  saveNicknameMap,
} from '@/lib/storage';
import { fetchShabbatTimes } from '@/lib/hebcal';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import type { Employee } from '@/lib/types';

// Minutes to add to Havdalah time — applied ONLY for explicit מוצ"ש mentions.
const MOTZAEI_OFFSET_MINUTES = 10;

// Day keyword → index (0 = Sunday … 6 = Saturday)
const DAY_MAP: Record<string, number> = {
  ראשון: 0, sunday: 0, sun: 0,
  שני: 1, monday: 1, mon: 1,
  שלישי: 2, tuesday: 2, tue: 2,
  רביעי: 3, wednesday: 3, wed: 3,
  חמישי: 4, thursday: 4, thu: 4,
  שישי: 5, friday: 5, fri: 5,
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

const IGNORE_LIST = new Set([
  // Single-char prefix remnants
  'מ', 'ב', 'ו', 'ה', 'ל',
  // Connectors / prepositions
  'עד', 'של', 'את', 'גם', 'וגם', 'עם', 'כי', 'אם', 'and',
  // Day/time prepositions
  'ביום', 'בשעה', 'משעה',
  // Pronouns / relative clauses
  'שהוא', 'שהיא', 'הוא', 'היא',
  // Verbs / speech
  'אמר', 'אמרה', 'אמרו', 'רוצה', 'רצה',
  'יכול', 'יכולה', 'יכל', 'יכלה',
  'לעבוד', 'לעבד', 'אפשר', 'בסדר',
  // Time / period words
  'יום', 'הלילה',
  // Closing / end-of-day terms
  'סגירה', 'הסגירה', 'סוף', 'הסוף', 'חצות',
]);

const HEBREW_FILLER = [
  'וגם', 'גם', 'יכולה', 'יכול', 'יכלה', 'יכל', 'לעבוד', 'לעבד', 'אפשר', 'בסדר',
  'את', 'של', 'עם', 'עד', 'משעה', 'בשעה',
  'אמר', 'אמרה', 'אמרו', 'רוצה', 'רצה', 'שהוא', 'שהיא', 'הוא', 'היא',
  'ביום',
  'סגירה', 'הסגירה', 'סוף', 'הסוף', 'חצות',
  'כי', 'אם', 'יום',
];

// ── Explicit HH:mm time token matching ──────────────────────────────────────
function matchTimeToken(token: string): { start: string; end: string } | null {
  let cleaned = token.replace(/^[בולמ][-־]?/, '');
  if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
    const [h, m] = cleaned.split(':');
    const padded = `${h.padStart(2, '0')}:${m}`;
    return { start: padded, end: padded < '13:00' ? '17:30' : '23:00' };
  }
  if (/^\d{1,2}$/.test(cleaned)) {
    const hour = parseInt(cleaned, 10);
    if (hour >= 6 && hour <= 23) {
      const padded = `${String(hour).padStart(2, '0')}:00`;
      return { start: padded, end: padded < '13:00' ? '17:30' : '23:00' };
    }
  }
  return null;
}

// ── Fuzzy shift-type matching ────────────────────────────────────────────────
function matchShiftType(normedToken: string): { start: string; end: string } | null {
  if (normedToken in SHIFT_TIMES) return SHIFT_TIMES[normedToken];
  for (const key of Object.keys(SHIFT_TIMES)) {
    if (normedToken.includes(key)) return SHIFT_TIMES[key];
  }
  return null;
}

// ── Fuzzy day matching ───────────────────────────────────────────────────────
function matchDay(normedToken: string): number | null {
  if (normedToken in DAY_MAP) return DAY_MAP[normedToken];
  return null;
}

interface ParsedShift {
  employeeId: string;
  employeeName: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  note?: string;
  isExplicitMotzaei?: boolean;
}

// Represents an employee line that contained "פול שבוע" — manager must choose slot.
interface FullWeekPending {
  employee: Employee;
}

interface ParseResult {
  shifts: ParsedShift[];
  warnings: string[];
  fullWeekRequests: FullWeekPending[];
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

// ── Levenshtein distance (inline, no dependencies) ───────────────────────────
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array<number>(lb + 1);
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

// ── Employee matching — nickname map first, then exact/prefix/substring, then fuzzy ──
function matchEmployee(
  name: string,
  employees: Employee[],
  warnings: string[],
  nicknames: Record<string, string> = {}
): Employee | undefined {
  const trimmed = name.trim();

  // Tier 0: nickname map — direct employeeId lookup (case-insensitive key check)
  const nicknameId = nicknames[trimmed] ?? nicknames[trimmed.toLowerCase()];
  if (nicknameId) {
    const byId = employees.find((e) => e.id === nicknameId);
    if (byId) return byId;
  }

  const n = trimmed.toLowerCase();

  // Tier 1: exact full-name match — fastest path, no ambiguity possible
  const exactFull = employees.find((e) => e.name.toLowerCase() === n);
  if (exactFull) return exactFull;

  // Tier 2: full-name substring / prefix match WITH ambiguity check
  const fullMatches = employees.filter((e) => {
    const en = e.name.toLowerCase();
    return en.startsWith(n) || n.startsWith(en) || (n.length >= 3 && en.includes(n));
  });
  if (fullMatches.length === 1) return fullMatches[0];
  if (fullMatches.length > 1) {
    warnings.push(
      `שם "${name}" מתאים למספר עובדים: ${fullMatches.map((e) => e.name).join(', ')} — נבחר ${fullMatches[0].name}`
    );
    return fullMatches[0];
  }

  // Tier 3: first-name-only (any name part) match WITH ambiguity check
  const partMatches = employees.filter((e) => {
    const parts = e.name.toLowerCase().split(' ');
    return parts.some((p) => p === n || p.startsWith(n) || n.startsWith(p));
  });
  if (partMatches.length === 1) return partMatches[0];
  if (partMatches.length > 1) {
    warnings.push(
      `שם "${name}" מתאים למספר עובדים: ${partMatches.map((e) => e.name).join(', ')} — נבחר ${partMatches[0].name}`
    );
    return partMatches[0];
  }

  // Tier 4: fuzzy matching — compare n against full name AND each name part
  let bestEmp: Employee | undefined;
  let bestDist = Infinity;
  for (const emp of employees) {
    const en = emp.name.toLowerCase();
    const distFull = levenshtein(n, en);
    const distPart = Math.min(...en.split(' ').map((part) => levenshtein(n, part)));
    const dist = Math.min(distFull, distPart);
    if (dist < bestDist) {
      bestDist = dist;
      bestEmp = emp;
    }
  }

  if (bestEmp) {
    const shortestPart = bestEmp.name
      .toLowerCase()
      .split(' ')
      .reduce((min, p) => Math.min(min, p.length), Infinity);
    const threshold = Math.max(2, Math.ceil(shortestPart * 0.3));
    if (bestDist <= threshold) {
      warnings.push(`שם "${name}" לא נמצא בדיוק — הוצע ${bestEmp.name}`);
      return bestEmp;
    }
  }

  return undefined;
}

// ── Authoritative token cleaner ───────────────────────────────────────────────
function cleanToken(token: string): string {
  let t = token.replace(/[״""''׳"'`]/g, '').toLowerCase();
  t = t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
  t = _stripPrefixRecursive(t);
  return t;
}

const _CLEAN_PREFIXES = new Set(['ב', 'ו', 'ל', 'מ', 'ה']);

function _isCleanTarget(s: string): boolean {
  return (
    s in DAY_MAP ||
    s in SHIFT_TIMES ||
    MOTZAEI_TOKENS.has(s) ||
    s === 'מוצאי' ||
    IGNORE_LIST.has(s) ||
    /^\d{1,2}:\d{2}$/.test(s)
  );
}

function _stripPrefixRecursive(s: string): string {
  if (s.length < 3) return s;
  const first = s[0];
  if (!_CLEAN_PREFIXES.has(first)) return s;
  const rest = s.slice(1);
  const deeper = _stripPrefixRecursive(rest);
  if (_isCleanTarget(deeper)) return deeper;
  if (_isCleanTarget(rest)) return rest;
  return s;
}

// Backward-compat alias — "clean without prefix strip" for call-sites that need raw norm.
function norm(token: string): string {
  let t = token.replace(/[״""''׳"'`]/g, '').toLowerCase();
  t = t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
  return t;
}

const MOTZAEI_TOKENS = new Set(['מוצש', 'motzash']);

// ORDER MATTERS: longer/more-specific phrases must precede shorter ones.
const FULL_WEEK_PHRASES = [
  'כל ימות השבוע',
  'כל ימי השבוע',
  'כל השבוע',
  'פול שבוע',
  'full week',
  'כל שבוע',
];

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ── Strip Hebrew filler from raw text ─────────────────────────────────────────
function stripHebrewFiller(line: string): string {
  let result = line;
  for (const filler of HEBREW_FILLER) {
    result = result.replace(new RegExp(`(?<=^|[\\s,،])${filler}(?=$|[\\s,،])`, 'g'), ' ');
  }
  result = result.replace(/(?<=^|[\s,،])[בהלו][-־]/g, '');
  return result;
}

// ── Pre-process time ranges ──────────────────────────────────────────────────
function normalizeTimeRanges(line: string): { text: string; fullDayStart: string | null; fullDayEnd: string | null } {
  let result = line;
  let fullDayStart: string | null = null;
  let fullDayEnd: string | null = null;

  function toTime(s: string): string {
    return s.includes(':') ? s : `${s}:00`;
  }
  function toEndTime(s: string): string {
    if (/^(סגירה|הסגירה|סוף|הסוף|הלילה|חצות)$/.test(s)) return '23:00';
    return toTime(s);
  }
  function checkFullDay(startStr: string, endStr: string): boolean {
    const startPadded = toTime(startStr).padStart(5, '0');
    const endPadded   = toEndTime(endStr).padStart(5, '0');
    return startPadded < '16:00' && endPadded > '19:00';
  }

  result = result.replace(
    /מ[-־]?\s*(\d{1,2}(?::\d{2})?)\s*עד\s*(\d{1,2}(?::\d{2})?)/g,
    (_match, startT: string, endT: string) => {
      if (checkFullDay(startT, endT)) { fullDayStart = toTime(startT); fullDayEnd = toEndTime(endT); }
      return toTime(startT);
    }
  );
  result = result.replace(
    /(\d{1,2}(?::\d{2})?)\s*עד\s*(\d{1,2}(?::\d{2})?)/g,
    (_match, startT: string, endT: string) => {
      if (checkFullDay(startT, endT)) { fullDayStart = toTime(startT); fullDayEnd = toEndTime(endT); }
      return toTime(startT);
    }
  );
  result = result.replace(
    /(\d{1,2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}(?::\d{2})?)/g,
    (_match, startT: string, endT: string) => {
      if (checkFullDay(startT, endT)) { fullDayStart = toTime(startT); fullDayEnd = toEndTime(endT); }
      return toTime(startT);
    }
  );
  result = result.replace(
    /משעה\s+(\d{1,2}(:\d{2})?)/g,
    (_match, time: string) => toTime(time)
  );
  const closingTermRegex = /(?:מ[-־]?\s*)?(\d{1,2}(?::\d{2})?)\s*עד\s*(סגירה|הסגירה|סוף|הסוף|הלילה|חצות)/;
  const closingMatch = line.match(closingTermRegex);
  if (closingMatch) {
    const startT = toTime(closingMatch[1]);
    if (startT.padStart(5, '0') < '16:00') {
      fullDayStart = startT;
      fullDayEnd   = '23:00';
    }
    result = result.replace(/(סגירה|הסגירה|סוף|הסוף|הלילה|חצות)/g, '');
  }

  return { text: result, fullDayStart, fullDayEnd };
}

function stripHebrewPrefix(normed: string): string {
  return _stripPrefixRecursive(normed);
}

// ── Hebrew connector / vav-prefix splitting ──────────────────────────────────
function splitHebrewConnectors(rawTokens: string[]): string[] {
  const out: string[] = [];
  for (const t of rawTokens) {
    const n = norm(t);
    const cleaned = cleanToken(t);
    if (IGNORE_LIST.has(n) || IGNORE_LIST.has(cleaned) || n === 'and') continue;
    if (t.startsWith('ו-') || t.startsWith('ו־')) {
      const rest = t.slice(2);
      if (rest) out.push(rest);
      continue;
    }
    if (t.startsWith('ו') && t.length > 1) {
      const rest = t.slice(1);
      const restNormed = norm(rest);
      if (
        restNormed in DAY_MAP ||
        matchShiftType(restNormed) !== null ||
        MOTZAEI_TOKENS.has(restNormed) ||
        restNormed === 'מוצאי'
      ) {
        out.push(rest);
        continue;
      }
      const prefixStripped = stripHebrewPrefix(restNormed);
      if (prefixStripped !== restNormed) {
        out.push(prefixStripped);
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

// ── Detect multi-word מוצאי שבת ──────────────────────────────────────────────
function mergeMotzaeiShabbat(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = norm(tokens[i]);
    if (n === 'מוצאי') {
      if (i + 1 < tokens.length && norm(tokens[i + 1]) === 'שבת') {
        out.push('מוצש');
        i++;
      } else {
        out.push('מוצש');
      }
    } else {
      out.push(tokens[i]);
    }
  }
  return out;
}

function parseText(
  text: string,
  employees: Employee[],
  weekDates: string[],
  havdalahTime: string | null,
  nicknames: Record<string, string> = {}
): ParseResult {
  const shifts: ParsedShift[] = [];
  const warnings: string[] = [];
  const fullWeekRequests: FullWeekPending[] = [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('#'));

  for (const line of lines) {
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
        const lineLower = line.toLowerCase();
        for (const emp of employees) {
          const idx = lineLower.indexOf(emp.name.toLowerCase());
          if (idx >= 0) {
            rawName = emp.name;
            restLine = (line.slice(0, idx) + ' ' + line.slice(idx + emp.name.length)).trim();
            break;
          }
        }
      }
      if (!rawName) continue;
    }

    const employee = matchEmployee(rawName, employees, warnings, nicknames);
    if (!employee) {
      warnings.push(`עובד לא נמצא: "${rawName}" — הוסף אותו קודם בניהול עובדים`);
      continue;
    }

    // ── Collective expression: "כל השבוע" / "פול שבוע" ──────────────────
    // Zero-hallucination policy: pause and queue for manager confirmation.
    // Do NOT auto-assign slots — the manager must choose Morning / Evening / Both.
    const fullWeekPhrase = FULL_WEEK_PHRASES.find((p) => restLine.includes(p));
    if (fullWeekPhrase) {
      if (!fullWeekRequests.find((r) => r.employee.id === employee.id)) {
        fullWeekRequests.push({ employee });
      }
      continue; // skip token processing — manager must confirm
    }

    // ── Strip filler + Tokenise ─────────────────────────────────────────
    const { text: timeNormalized, fullDayStart, fullDayEnd } = normalizeTimeRanges(restLine);
    const cleanedLine = stripHebrewFiller(timeNormalized);
    const rawTokens = cleanedLine.split(/[\s,،]+/).filter(Boolean);
    const filteredTokens = rawTokens.filter((tok) => {
      const stripped = tok.replace(/^[בולמ][-־]?/, '');
      if (/^\d{1,2}$/.test(stripped)) {
        const num = parseInt(stripped, 10);
        return num >= 6 && num <= 23;
      }
      return true;
    });
    const expanded = splitHebrewConnectors(filteredTokens);
    const tokens = mergeMotzaeiShabbat(expanded);

    let pendingDay: number | null = null;
    let pendingShift: { start: string; end: string } | null = null;
    let lastCommittedDay: number | null = null;

    function pushShift(
      dayIdx: number,
      start: string,
      end: string,
      note: string | undefined,
      isExplicitMotzaei: boolean
    ) {
      const date = weekDates[dayIdx];
      if (!date) return;

      let adjStart = start;
      let adjNote = note;

      // Zero-hallucination: no MOTZAEI_OFFSET_MINUTES for regular Saturday shifts.
      // Only enforce havdalah as a hard minimum (no extra padding).
      if (dayIdx === 6 && havdalahTime && !isExplicitMotzaei) {
        if (adjStart < havdalahTime) {
          adjStart = havdalahTime;
          adjNote = adjNote ?? `פתיחה מצאת שבת (${havdalahTime})`;
        }
      }

      shifts.push({
        employeeId: employee!.id,
        employeeName: employee!.name,
        date,
        dayName: isExplicitMotzaei ? 'מוצ״ש' : HEBREW_DAY_NAMES[dayIdx],
        startTime: adjStart,
        endTime: end,
        note: adjNote,
        isExplicitMotzaei,
      });
    }

    function commitPair(
      dayIdx: number,
      shiftTime: { start: string; end: string },
      note?: string,
      isExplicitMotzaei = false
    ) {
      if (dayIdx === 5) {
        warnings.push(`יום שישי הוא יום מנוחה — לא נוצרה משמרת (${employee!.name})`);
        return;
      }
      if (dayIdx === 6 && shiftTime.start < '16:00') {
        warnings.push(`שבת בוקר אינו פעיל — לא נוצרה משמרת (${employee!.name})`);
        return;
      }

      // ── Auto-Split "Full Day" Rule ──
      if (fullDayStart && !isExplicitMotzaei && shiftTime.start < '16:00') {
        pushShift(dayIdx, shiftTime.start, '17:30', note, false);
        pushShift(dayIdx, '17:30', fullDayEnd ?? '23:00', note, false);
        lastCommittedDay = dayIdx;
        return;
      }

      pushShift(dayIdx, shiftTime.start, shiftTime.end, note, isExplicitMotzaei);
      lastCommittedDay = dayIdx;
    }

    for (let ti = 0; ti < tokens.length; ti++) {
      const t = tokens[ti];
      const n = norm(t);
      const ns = cleanToken(t);

      if (IGNORE_LIST.has(ns) && !(ns in DAY_MAP) && !(ns in SHIFT_TIMES) && !MOTZAEI_TOKENS.has(ns) && matchTimeToken(t) === null) {
        continue;
      }

      if (MOTZAEI_TOKENS.has(ns)) {
        if (pendingDay !== null && pendingShift !== null) {
          commitPair(pendingDay, pendingShift);
        }
        pendingDay = null;
        pendingShift = null;
        // Explicit מוצ"ש: apply MOTZAEI_OFFSET_MINUTES padding (user explicitly requested it)
        const motzaeiStart = havdalahTime ? addMinutes(havdalahTime, MOTZAEI_OFFSET_MINUTES) : '17:30';
        const motzaeiNote = havdalahTime
          ? `משמרת מוצ״ש — פתיחה ${MOTZAEI_OFFSET_MINUTES} דק׳ אחרי צאת שבת (${havdalahTime})`
          : `פתיחה מוצ״ש`;
        commitPair(6, { start: motzaeiStart, end: '23:00' }, motzaeiNote, true);

      } else if (matchDay(ns) !== null) {

        if (pendingDay !== null && pendingShift !== null) {
          commitPair(pendingDay, pendingShift);
          pendingDay = null;
          pendingShift = null;
        } else if (pendingDay !== null) {
          pendingDay = null;
        }

        const newDay = matchDay(ns)!;
        if (pendingShift !== null) {
          commitPair(newDay, pendingShift);
          pendingShift = null;
        } else {
          pendingDay = newDay;
        }

      } else {
        const timeMatch = matchTimeToken(t) ?? matchTimeToken(n);
        const shiftMatch = timeMatch ?? matchShiftType(ns) ?? matchShiftType(n);
        if (shiftMatch) {
          if (pendingDay !== null) {
            commitPair(pendingDay, shiftMatch);
            pendingDay = null;
            pendingShift = null;
          } else if (lastCommittedDay !== null) {
            commitPair(lastCommittedDay, shiftMatch);
            pendingShift = null;
          } else {
            pendingShift = shiftMatch;
          }
        }
      }
    }

    if (pendingDay !== null && pendingShift !== null) {
      commitPair(pendingDay, pendingShift);
    }
  }

  return { shifts, warnings, fullWeekRequests };
}

// ── Generate full-week shifts after manager confirms slot choice ──────────────
// Called when the manager taps "אשר ויצור משמרות" after choosing Morning/Evening/Both.
function generateFullWeekShifts(
  employee: Employee,
  choice: 'morning' | 'evening' | 'both',
  weekDates: string[],
  havdalahTime: string | null
): ParsedShift[] {
  const result: ParsedShift[] = [];
  const WEEKDAYS = [0, 1, 2, 3, 4]; // Sunday–Thursday

  for (const dayIdx of WEEKDAYS) {
    const date = weekDates[dayIdx];
    if (!date) continue;

    if (choice === 'morning' || choice === 'both') {
      result.push({
        employeeId: employee.id,
        employeeName: employee.name,
        date,
        dayName: HEBREW_DAY_NAMES[dayIdx],
        startTime: SHIFT_TIMES['בוקר'].start,
        endTime: SHIFT_TIMES['בוקר'].end,
        isExplicitMotzaei: false,
      });
    }

    if (choice === 'evening' || choice === 'both') {
      result.push({
        employeeId: employee.id,
        employeeName: employee.name,
        date,
        dayName: HEBREW_DAY_NAMES[dayIdx],
        startTime: SHIFT_TIMES['ערב'].start,
        endTime: SHIFT_TIMES['ערב'].end,
        isExplicitMotzaei: false,
      });
    }
  }

  // Saturday — evening only (no morning on Shabbat), no MOTZAEI_OFFSET_MINUTES padding
  if (choice === 'evening' || choice === 'both') {
    const satDate = weekDates[6];
    if (satDate) {
      const satStart = havdalahTime ?? SHIFT_TIMES['ערב'].start;
      const satNote = havdalahTime ? `פתיחה מצאת שבת (${havdalahTime})` : undefined;
      result.push({
        employeeId: employee.id,
        employeeName: employee.name,
        date: satDate,
        dayName: 'שבת',
        startTime: satStart,
        endTime: '23:00',
        note: satNote,
        isExplicitMotzaei: false,
      });
    }
  }

  return result;
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
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [draftShifts, setDraftShifts] = useState<ParsedShift[]>([]);
  const [fullWeekPending, setFullWeekPending] = useState<FullWeekPending[]>([]);
  const [fullWeekChoices, setFullWeekChoices] = useState<Record<string, 'morning' | 'evening' | 'both'>>({});
  const [weekDatesCache, setWeekDatesCache] = useState<string[]>([]);
  const [havdalahCache, setHavdalahCache] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [doubleShiftToasts, setDoubleShiftToasts] = useState<string[]>([]);
  const [showDoubleToast, setShowDoubleToast] = useState(false);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newNicknameTarget, setNewNicknameTarget] = useState('');

  // Load persisted nicknames whenever the modal opens
  useEffect(() => {
    if (isOpen) setNicknames(getNicknameMap());
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
    setText('');
    setParseWarnings([]);
    setDraftShifts([]);
    setFullWeekPending([]);
    setFullWeekChoices({});
    setImported(false);
    setShowToast(false);
    setShowDoubleToast(false);
    setDoubleShiftToasts([]);
    setShowNicknameEditor(false);
    setNewNickname('');
    setNewNicknameTarget('');
  }, [onClose]);

  const handleParse = useCallback(async () => {
    setParsing(true);
    const employees = getEmployees();
    const wDates = getWeekDates(weekId);
    setWeekDatesCache(wDates);
    const fridayDate = wDates[5];
    const shabbatTimes = fridayDate ? await fetchShabbatTimes(fridayDate) : null;
    const havdalah = shabbatTimes?.havdalah ?? null;
    setHavdalahCache(havdalah);
    const result = parseText(text, employees, wDates, havdalah, nicknames);

    // Deduplicate within the batch
    const batchSeen = new Set<string>();
    const deduped = result.shifts.filter((s) => {
      const key = `${s.employeeId}:${s.date}:${getShiftSlot(s.startTime)}`;
      if (batchSeen.has(key)) return false;
      batchSeen.add(key);
      return true;
    });

    setParseWarnings(result.warnings);
    setDraftShifts(deduped);
    setFullWeekPending(result.fullWeekRequests);
    setFullWeekChoices({});
    setImported(false);
    setParsing(false);
  }, [text, weekId, nicknames]);

  // Called after manager has chosen Morning / Evening / Both for every full-week employee
  const handleApplyFullWeekChoices = useCallback(() => {
    const allChosen = fullWeekPending.every((r) => fullWeekChoices[r.employee.id]);
    if (!allChosen) return;

    const newShifts: ParsedShift[] = [];
    for (const req of fullWeekPending) {
      const choice = fullWeekChoices[req.employee.id];
      const generated = generateFullWeekShifts(req.employee, choice, weekDatesCache, havdalahCache);
      newShifts.push(...generated);
    }

    // Dedup new full-week shifts against existing draft
    const batchSeen = new Set(
      draftShifts.map((s) => `${s.employeeId}:${s.date}:${getShiftSlot(s.startTime)}`)
    );
    const filtered = newShifts.filter((s) => {
      const key = `${s.employeeId}:${s.date}:${getShiftSlot(s.startTime)}`;
      if (batchSeen.has(key)) return false;
      batchSeen.add(key);
      return true;
    });

    setDraftShifts((prev) => [...prev, ...filtered]);
    setFullWeekPending([]);
    setFullWeekChoices({});
  }, [fullWeekPending, fullWeekChoices, weekDatesCache, havdalahCache, draftShifts]);

  const handleDeleteDraftShift = useCallback((index: number) => {
    setDraftShifts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // "Save All" — writes draft to localStorage only after manager confirms
  const handleSaveAll = useCallback(() => {
    if (draftShifts.length === 0) return;

    // Remove existing shifts for every (employee, day) pair in this batch
    const affectedKeys = new Set(draftShifts.map((s) => `${s.employeeId}:${s.date}`));
    for (const ex of getShifts(weekId)) {
      if (affectedKeys.has(`${ex.employeeId}:${ex.date}`)) {
        removeShift(ex.id);
      }
    }

    const doubleMessages: string[] = [];
    const batchSaved: { employeeId: string; date: string; startTime: string }[] = [];

    for (const s of draftShifts) {
      const slot = getShiftSlot(s.startTime);
      const otherSlotVal = slot === 'morning' ? 'evening' : 'morning';
      const batchOther = batchSaved.find(
        (b) => b.employeeId === s.employeeId && b.date === s.date && getShiftSlot(b.startTime) === otherSlotVal
      );
      const storageOther = findOtherSlotShift(weekId, s.employeeId, s.date, s.startTime);
      if (batchOther || storageOther) {
        doubleMessages.push(`שים לב: ${s.employeeName} עובד היום כפול (בוקר וערב)`);
      }

      saveShift({
        id: crypto.randomUUID(),
        weekId,
        date: s.date,
        employeeId: s.employeeId,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note,
      });
      batchSaved.push({ employeeId: s.employeeId, date: s.date, startTime: s.startTime });
    }

    if (doubleMessages.length > 0) {
      const unique = [...new Set(doubleMessages)];
      setDoubleShiftToasts(unique);
      setShowDoubleToast(true);
      setTimeout(() => setShowDoubleToast(false), 3500);
    }

    setImported(true);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
    setTimeout(() => {
      onImported();
      onClose();
      setText('');
      setParseWarnings([]);
      setDraftShifts([]);
      setImported(false);
      setShowDoubleToast(false);
      setDoubleShiftToasts([]);
    }, 800);
  }, [draftShifts, weekId, onImported, onClose]);

  const handleAddNickname = useCallback(() => {
    if (!newNickname.trim() || !newNicknameTarget) return;
    const updated = { ...nicknames, [newNickname.trim()]: newNicknameTarget };
    setNicknames(updated);
    saveNicknameMap(updated);
    setNewNickname('');
    setNewNicknameTarget('');
  }, [nicknames, newNickname, newNicknameTarget]);

  const handleDeleteNickname = useCallback((nickname: string) => {
    const updated = { ...nicknames };
    delete updated[nickname];
    setNicknames(updated);
    saveNicknameMap(updated);
  }, [nicknames]);

  const hasContent =
    draftShifts.length > 0 || parseWarnings.length > 0 || fullWeekPending.length > 0;
  const allFullWeekChosen =
    fullWeekPending.length > 0 &&
    fullWeekPending.every((r) => fullWeekChoices[r.employee.id]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ai-sorter-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70"
            onClick={handleClose}
          >
            <motion.div
              key="ai-sorter-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-warm-50 dark:bg-slate-800 rounded-t-3xl overflow-hidden max-h-[88vh] flex flex-col"
            >
              {/* Static Header */}
              <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-warm-200 dark:border-slate-700">
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
              <div
                className="overflow-y-auto flex-1 p-4"
                style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  הדבק טקסט עם שמות עובדים וימים. לדוגמה:
                </p>
                <div
                  className="bg-warm-100 dark:bg-slate-700/50 rounded-xl p-3 mb-3 text-xs text-slate-600 dark:text-slate-300 font-mono leading-relaxed"
                  dir="rtl"
                >
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
                    setParseWarnings([]);
                    setDraftShifts([]);
                    setFullWeekPending([]);
                    setFullWeekChoices({});
                  }}
                  placeholder="הדבק כאן את הטקסט..."
                  rows={5}
                  dir="auto"
                  className="w-full bg-warm-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none mb-1"
                />

                {/* Nickname settings toggle */}
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => setShowNicknameEditor((v) => !v)}
                    className="text-xs text-blue-500 dark:text-blue-400 underline underline-offset-2"
                  >
                    {showNicknameEditor ? 'סגור ניהול כינויים' : 'ניהול כינויים'}
                  </button>
                </div>

                {/* Nickname editor (collapsible) */}
                {showNicknameEditor && (
                  <div className="bg-warm-100 dark:bg-slate-700/50 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      כינויים לעובדים
                    </p>

                    {Object.keys(nicknames).length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                        אין כינויים מוגדרים
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1 mb-2">
                        {Object.entries(nicknames).map(([nick, empId]) => {
                          const emp = getEmployees().find((e) => e.id === empId);
                          return (
                            <div
                              key={nick}
                              className="flex items-center justify-between bg-white/60 dark:bg-slate-600/40 rounded-lg px-2.5 py-1.5"
                            >
                              <span className="text-xs text-slate-700 dark:text-slate-200">
                                <span className="font-bold">{nick}</span>
                                <span className="text-slate-400 dark:text-slate-500 mx-1">→</span>
                                <span>{emp?.name ?? empId}</span>
                              </span>
                              <button
                                onClick={() => handleDeleteNickname(nick)}
                                className="min-h-[32px] min-w-[32px] flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                                aria-label="מחק כינוי"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add nickname form */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newNickname}
                        onChange={(e) => setNewNickname(e.target.value)}
                        placeholder="כינוי"
                        dir="rtl"
                        className="flex-1 min-w-0 bg-white dark:bg-slate-600 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                      />
                      <select
                        value={newNicknameTarget}
                        onChange={(e) => setNewNicknameTarget(e.target.value)}
                        className="flex-1 min-w-0 bg-white dark:bg-slate-600 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        dir="rtl"
                      >
                        <option value="">בחר עובד</option>
                        {getEmployees().map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddNickname}
                        disabled={!newNickname.trim() || !newNicknameTarget}
                        className="min-h-[32px] px-3 bg-blue-500 text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-blue-600 transition-colors"
                      >
                        הוסף
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleParse}
                  disabled={!text.trim() || parsing}
                  className="w-full bg-blue-500 text-white font-bold rounded-xl py-2.5 min-h-[44px] hover:bg-blue-600 active:bg-blue-700 active:scale-[0.97] disabled:opacity-40 transition-all duration-150 mb-4"
                >
                  {parsing ? '⏳ מושך זמני שבת...' : 'פענח טקסט'}
                </button>

                {/* Results area */}
                {hasContent && (
                  <div className="flex flex-col gap-3">

                    {/* Warnings */}
                    {parseWarnings.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-3">
                        <p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 mb-2">
                          ⚠️ הערות:
                        </p>
                        <div className="flex flex-col gap-1">
                          {parseWarnings.map((w, i) => (
                            <p key={i} className="text-xs text-yellow-600 dark:text-yellow-500">
                              {w}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full-week choice panel — blocks saving until all choices are made */}
                    {fullWeekPending.length > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-xl p-3">
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-3">
                          📅 זוהה &quot;פול שבוע&quot; — בחר סוג משמרת:
                        </p>
                        <div className="flex flex-col gap-3">
                          {fullWeekPending.map((req) => (
                            <div key={req.employee.id}>
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                                {req.employee.name}
                              </p>
                              <div className="flex gap-2">
                                {(['morning', 'evening', 'both'] as const).map((opt) => {
                                  const label =
                                    opt === 'morning'
                                      ? '☀️ בוקר'
                                      : opt === 'evening'
                                      ? '🌙 ערב'
                                      : '📅 כפול';
                                  const chosen = fullWeekChoices[req.employee.id] === opt;
                                  return (
                                    <button
                                      key={opt}
                                      onClick={() =>
                                        setFullWeekChoices((prev) => ({
                                          ...prev,
                                          [req.employee.id]: opt,
                                        }))
                                      }
                                      className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold transition-all ${
                                        chosen
                                          ? 'bg-purple-600 text-white shadow-sm'
                                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-purple-200 dark:border-purple-700/50'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handleApplyFullWeekChoices}
                          disabled={!allFullWeekChosen}
                          className="mt-3 w-full min-h-[44px] bg-purple-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 hover:bg-purple-700 transition-colors"
                        >
                          אשר ויצור משמרות
                        </button>
                      </div>
                    )}

                    {/* Draft shifts table — per-row delete, nothing saves until "שמור הכל" */}
                    {draftShifts.length > 0 ? (
                      <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          ✓ {draftShifts.length} משמרות לאישור:
                        </p>
                        <div className="overflow-x-auto" style={{ touchAction: 'pan-x' }}>
                          <div className="flex flex-col gap-1.5 min-w-[280px]">
                            {draftShifts.map((s, i) => (
                              <div
                                key={i}
                                className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                                    <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                      {s.employeeName}
                                    </span>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 shrink-0">
                                      {s.dayName} · {s.startTime}–{s.endTime}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteDraftShift(i)}
                                    className="min-h-[32px] min-w-[32px] flex items-center justify-center text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                                    aria-label="הסר משמרת"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {s.note && (
                                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5 truncate">
                                    {s.note}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : parseWarnings.length === 0 && fullWeekPending.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                        לא זוהו משמרות תקינות
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Footer — Save All (writes to localStorage only on tap) */}
              {draftShifts.length > 0 && (
                <div className="flex-shrink-0 p-4 border-t border-warm-200 dark:border-slate-700">
                  <AnimatePresence mode="wait">
                    {imported ? (
                      <motion.button
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                        disabled
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white font-bold rounded-xl min-h-[44px]"
                      >
                        <span>✓</span>
                        <span>יובאו {draftShifts.length} משמרות!</span>
                      </motion.button>
                    ) : (
                      <motion.button
                        key="save"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSaveAll}
                        className="w-full bg-green-600 text-white font-bold rounded-xl py-3 min-h-[44px] hover:bg-green-700 active:bg-green-800 transition-all duration-150"
                      >
                        שמור הכל ({draftShifts.length} משמרות)
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success toast — rendered outside modal so it persists after close */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-[calc(1rem+env(safe-area-inset-top))] inset-x-0 mx-auto w-fit z-[200] pointer-events-none"
          >
            <div className="bg-green-600 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-lg shadow-green-600/30 flex items-center gap-2">
              <span>המשמרות שובצו בהצלחה!</span>
              <span>✅</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double-shift yellow toast — stacked below the green one */}
      <AnimatePresence>
        {showDoubleToast && doubleShiftToasts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.15 }}
            className="fixed top-[calc(4.5rem+env(safe-area-inset-top))] inset-x-0 mx-auto w-fit z-[200] pointer-events-none flex flex-col gap-2 items-center"
          >
            {doubleShiftToasts.map((msg, i) => (
              <div
                key={i}
                className="bg-amber-400 text-amber-900 text-sm font-bold px-5 py-3 rounded-2xl shadow-lg shadow-amber-400/30 max-w-[360px] text-center"
              >
                {msg}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
