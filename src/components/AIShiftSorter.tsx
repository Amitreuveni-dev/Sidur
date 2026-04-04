'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmployees, getShifts, saveShift, removeShift, getShiftSlot, getSlotLabel, findOtherSlotShift } from '@/lib/storage';
import { fetchShabbatTimes } from '@/lib/hebcal';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import type { Employee } from '@/lib/types';

// Minutes to add to Havdalah time for generic Saturday shifts (NOT explicit מוצ"ש)
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

// ── Comprehensive IGNORE_LIST ─────────────────────────────────────────────────
// After cleanToken() is applied, if the result is in this set the token is
// silently skipped.  Includes Hebrew filler
// words, single-char prefix remnants, connectors, pronouns, verbs, and
// prepositions that commonly appear in free-text shift descriptions.
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

// Hebrew filler words to strip from the raw line BEFORE tokenisation.
// Order matters: longer patterns first so "וגם" is matched before "ו".
const HEBREW_FILLER = [
  'וגם', 'גם', 'יכולה', 'יכול', 'יכלה', 'יכל', 'לעבוד', 'לעבד', 'אפשר', 'בסדר',
  'את', 'של', 'עם', 'עד', 'משעה', 'בשעה',
  // Verbs / pronouns / connectors
  'אמר', 'אמרה', 'אמרו', 'רוצה', 'רצה', 'שהוא', 'שהיא', 'הוא', 'היא',
  // Day/time prepositions
  'ביום',
  // Closing / end-of-day terms (NOT הלילה — it contains לילה which is a valid shift type)
  'סגירה', 'הסגירה', 'סוף', 'הסוף', 'חצות',
  // Extra fillers
  'כי', 'אם', 'יום',
];

// ── Explicit HH:mm time token matching ──────────────────────────────────────
// Catches tokens like "12:30", "19:00", "ב-12:30", "17" and maps to morning/evening.
function matchTimeToken(token: string): { start: string; end: string } | null {
  // Strip ב- / ו- / ל- / מ- prefix (with or without hyphen)
  let cleaned = token.replace(/^[בולמ][-־]?/, '');
  // Accept HH:mm OR bare hour (1-2 digits, no colon)
  if (/^\d{1,2}:\d{2}$/.test(cleaned)) {
    const [h, m] = cleaned.split(':');
    const padded = `${h.padStart(2, '0')}:${m}`;
    // Deep time recognition: times before 13:00 are morning (end 17:30),
    // times from 13:00 onwards default to closing (end 23:00)
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
// Checks whether a normalised token *contains* a known shift-type keyword
// (e.g. "בבוקר" contains "בוקר", "הערב" contains "ערב").
// Returns the matching SHIFT_TIMES entry or null.
function matchShiftType(normedToken: string): { start: string; end: string } | null {
  // 1. Exact match (fast path)
  if (normedToken in SHIFT_TIMES) return SHIFT_TIMES[normedToken];
  // 2. Contains check — iterate known Hebrew shift keywords
  for (const key of Object.keys(SHIFT_TIMES)) {
    if (normedToken.includes(key)) return SHIFT_TIMES[key];
  }
  return null;
}

// ── Fuzzy day matching ───────────────────────────────────────────────────────
// Same idea as matchShiftType but for day names.
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

// ── Levenshtein distance (inline, no dependencies) ───────────────────────────
function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Single-row DP — prev holds the previous row, curr the current one
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev]; // swap rows
  }
  return prev[lb];
}

// ── Employee matching — exact/prefix/substring first, then fuzzy ─────────────
function matchEmployee(
  name: string,
  employees: Employee[],
  warnings: string[]
): Employee | undefined {
  const n = name.trim().toLowerCase();

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
    // Threshold: max(2, 30% of the shortest name-part length)
    // Using the shortest part as the denominator keeps the bar proportional
    // when the input is a short first name; Math.max(2,...) prevents a
    // single-char part from collapsing the threshold to 0.
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

  // No confident match — caller will emit "employee not found" warning
  return undefined;
}

// ── Authoritative token cleaner ───────────────────────────────────────────────
// Single function that replaces the old norm() + stripHebrewPrefix() chain.
// 1. Strip gershayim / quotes: ״ " ' `
// 2. Lowercase (for Latin tokens)
// 3. Strip non-letter/digit chars from edges (Unicode-aware)
// 4. Recursively strip single-letter Hebrew prefixes (ו ב ל מ ה) when the
//    remainder is 2+ chars AND is a known keyword or IGNORE_LIST member.
function cleanToken(token: string): string {
  // Step 1+2: quotes + lowercase
  let t = token.replace(/[״""''׳"'`]/g, '').toLowerCase();
  // Step 3: strip edge punctuation
  t = t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
  // Step 4: recursive Hebrew prefix stripping
  t = _stripPrefixRecursive(t);
  return t;
}

// Prefixes that can be stripped from the start of a Hebrew token.
const _CLEAN_PREFIXES = new Set(['ב', 'ו', 'ל', 'מ', 'ה']);

// Returns true if `s` is a keyword the parser cares about (day, shift-type,
// motzaei, time pattern) or is in IGNORE_LIST.
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
  if (s.length < 3) return s; // need prefix char + at least 2 remaining
  const first = s[0];
  if (!_CLEAN_PREFIXES.has(first)) return s;
  const rest = s.slice(1);
  // Depth-first (greedy): try stripping deeper prefixes first
  // e.g. "ומהסגירה" → strip ו→מהסגירה → strip מ→הסגירה → strip ה→סגירה ✓
  const deeper = _stripPrefixRecursive(rest);
  if (_isCleanTarget(deeper)) return deeper;
  if (_isCleanTarget(rest)) return rest;
  return s;
}

// Backward-compat alias — old call-sites used norm(). Keep as thin wrapper.
function norm(token: string): string {
  // cleanToken already does everything norm used to do + prefix stripping.
  // Some call-sites need the raw normalised form WITHOUT prefix stripping
  // (e.g. splitHebrewConnectors checks the raw normed form before deciding
  // to split). We keep norm() as "clean without prefix strip" for those.
  let t = token.replace(/[״""''׳"'`]/g, '').toLowerCase();
  t = t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
  return t;
}

// Tokens that mean "Saturday evening" (Motzaei Shabbat) on their own.
const MOTZAEI_TOKENS = new Set(['מוצש', 'motzash']);

// Phrases meaning "all week" — expand to all active days (Sun–Thu + Sat).
// ORDER MATTERS: longer/more-specific phrases must precede shorter ones to
// prevent a short phrase being matched as a substring of a longer one via
// String.includes (e.g. 'כל שבוע' is a substring of 'כל השבוע').
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
// Removes filler words (גם, יכול, את, של, עם, …) and single-char prefixes
// (ב-, ה-, ל-) when attached via hyphen, BEFORE tokenisation.
function stripHebrewFiller(line: string): string {
  let result = line;
  // Remove filler words as whole words (space-bounded)
  for (const filler of HEBREW_FILLER) {
    // Global replace of the filler word when bounded by whitespace / start / end / comma
    result = result.replace(new RegExp(`(?<=^|[\\s,،])${filler}(?=$|[\\s,،])`, 'g'), ' ');
  }
  // Remove prefix-hyphen patterns: "ב-", "ה-", "ל-", "ו-" (e.g. "ב-ערב" → "ערב")
  result = result.replace(/(?<=^|[\s,،])[בהלו][-־]/g, '');
  return result;
}

// ── Pre-process time ranges ──────────────────────────────────────────────────
// Scans a line for time-range patterns and replaces them with a single
// canonical start-time token so matchTimeToken() can pick it up downstream.
// Also detects "full day" ranges and closing terms and marks them for auto-split.
// Returns { text, fullDayStart, fullDayEnd } — fullDayStart/End are set when
// a full-day range is detected and auto-split should happen.
function normalizeTimeRanges(line: string): { text: string; fullDayStart: string | null; fullDayEnd: string | null } {
  let result = line;
  let fullDayStart: string | null = null;
  let fullDayEnd: string | null = null;

  // Helper: parse a time token (HH:MM or bare hour) to canonical HH:MM
  function toTime(s: string): string {
    return s.includes(':') ? s : `${s}:00`;
  }
  // Helper: resolve closing terms to a canonical end time
  function toEndTime(s: string): string {
    if (/^(סגירה|הסגירה|סוף|הסוף|הלילה|חצות)$/.test(s)) return '23:00';
    return toTime(s);
  }

  // Helper: check if a time range spans a "full day" (start < 16:00 AND end > 19:00)
  function checkFullDay(startStr: string, endStr: string): boolean {
    const startPadded = toTime(startStr).padStart(5, '0');
    const endPadded   = toEndTime(endStr).padStart(5, '0');
    return startPadded < '16:00' && endPadded > '19:00';
  }

  // 0. "מ-HH:MM עד HH:MM" — Hebrew "from X until Y" with מ- prefix
  result = result.replace(
    /מ[-־]?\s*(\d{1,2}(?::\d{2})?)\s*עד\s*(\d{1,2}(?::\d{2})?)/g,
    (_match, startT: string, endT: string) => {
      if (checkFullDay(startT, endT)) {
        fullDayStart = toTime(startT);
        fullDayEnd   = toEndTime(endT);
      }
      return toTime(startT);
    }
  );
  // 1. "HH:MM עד HH:MM" — Hebrew "until" separator (no מ- prefix)
  result = result.replace(
    /(\d{1,2}(?::\d{2})?)\s*עד\s*(\d{1,2}(?::\d{2})?)/g,
    (_match, startT: string, endT: string) => {
      if (checkFullDay(startT, endT)) {
        fullDayStart = toTime(startT);
        fullDayEnd   = toEndTime(endT);
      }
      return toTime(startT);
    }
  );
  // 2. "HH:MM-HH:MM" or "HH:MM–HH:MM" (hyphen / en-dash)
  result = result.replace(
    /(\d{1,2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}(?::\d{2})?)/g,
    (_match, startT: string, endT: string) => {
      if (checkFullDay(startT, endT)) {
        fullDayStart = toTime(startT);
        fullDayEnd   = toEndTime(endT);
      }
      return toTime(startT);
    }
  );
  // 3. "משעה HH:MM" — strip prefix, keep the time
  result = result.replace(
    /משעה\s+(\d{1,2}(:\d{2})?)/g,
    (_match, time: string) => toTime(time)
  );
  // 4. Closing-term ranges: "12:30 עד סגירה" / "מ-12 עד חצות"
  //    Must check the ORIGINAL line before earlier replacements ate the closing term.
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

// stripHebrewPrefix is now folded into cleanToken(). This thin wrapper
// is kept for the few internal call-sites that pass an already-normed value
// and expect prefix stripping only (e.g. splitHebrewConnectors).
function stripHebrewPrefix(normed: string): string {
  return _stripPrefixRecursive(normed);
}

// ── Hebrew connector / vav-prefix splitting ──────────────────────────────────
// Turns "ושני" → ["שני"], "וגם" → [] (pure filler), "ו-ראשון" → ["ראשון"]
// Ensures connectors never swallow real day/shift tokens.
function splitHebrewConnectors(rawTokens: string[]): string[] {
  const out: string[] = [];
  for (const t of rawTokens) {
    const n = norm(t);
    const cleaned = cleanToken(t);
    // Pure connector / filler words — skip entirely (they are separators)
    if (IGNORE_LIST.has(n) || IGNORE_LIST.has(cleaned) || n === 'and') continue;

    // "ו-" prefix with hyphen (e.g. "ו-שני")
    if (t.startsWith('ו-') || t.startsWith('ו־')) {
      const rest = t.slice(2);
      if (rest) out.push(rest);
      continue;
    }

    // Vav prefix glued to a known keyword (e.g. "ושני", "וערב", "ומוצש", "ובוקר")
    // Also handles multi-prefix: "וברביעי" → strip ו → "ברביעי" → strip ב → "רביעי"
    if (t.startsWith('ו') && t.length > 1) {
      const rest = t.slice(1);
      const restNormed = norm(rest);
      // Direct match after stripping ו
      if (
        restNormed in DAY_MAP ||
        matchShiftType(restNormed) !== null ||
        MOTZAEI_TOKENS.has(restNormed) ||
        restNormed === 'מוצאי'
      ) {
        out.push(rest);
        continue;
      }
      // Try chaining: strip ו then strip Hebrew prefix (e.g. "וברביעי" → "רביעי")
      const prefixStripped = stripHebrewPrefix(restNormed);
      if (prefixStripped !== restNormed) {
        // prefixStripped matched a known keyword — push canonical form
        out.push(prefixStripped);
        continue;
      }
    }

    out.push(t);
  }
  return out;
}

// ── Detect multi-word מוצאי שבת ──────────────────────────────────────────────
// Merges consecutive tokens ["מוצאי", "שבת"] into a single "מוצש" token so the
// state machine handles them as one unit. Also handles "מוצאי" alone.
function mergeMotzaeiShabbat(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = norm(tokens[i]);
    if (n === 'מוצאי') {
      // Peek ahead — if next token is שבת, merge
      if (i + 1 < tokens.length && norm(tokens[i + 1]) === 'שבת') {
        out.push('מוצש'); // canonical form
        i++; // skip "שבת"
      } else {
        // "מוצאי" alone — treat as motzaei shabbat
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
      // Tier 1: employee name at the start of the line
      for (const emp of employees) {
        if (line.toLowerCase().startsWith(emp.name.toLowerCase())) {
          rawName = emp.name;
          restLine = line.slice(emp.name.length).trim();
          break;
        }
      }
      // Tier 2: employee name anywhere in the line (e.g. "במוצ״ש עמית")
      if (!rawName) {
        const lineLower = line.toLowerCase();
        for (const emp of employees) {
          const idx = lineLower.indexOf(emp.name.toLowerCase());
          if (idx >= 0) {
            rawName = emp.name;
            // restLine = everything except the matched name
            restLine = (line.slice(0, idx) + ' ' + line.slice(idx + emp.name.length)).trim();
            break;
          }
        }
      }
      if (!rawName) continue; // silently skip lines with no recognisable employee name
    }

    const employee = matchEmployee(rawName, employees, warnings);
    if (!employee) {
      warnings.push(`עובד לא נמצא: "${rawName}" — הוסף אותו קודם בניהול עובדים`);
      continue;
    }

    // ── Collective expression: "כל השבוע" / "פול שבוע" ──────────────────
    // Detect before tokenisation so the phrase doesn't confuse the token loop.
    // PHRASE ORDER in FULL_WEEK_PHRASES is critical — see constant definition.
    const fullWeekPhrase = FULL_WEEK_PHRASES.find((p) => restLine.includes(p));
    if (fullWeekPhrase) {
      // Strip the collective phrase, then detect shift type from remaining text.
      const remainingAfterPhrase = restLine.replace(fullWeekPhrase, ' ').trim();
      const { text: normalized } = normalizeTimeRanges(remainingAfterPhrase);
      const cleaned = stripHebrewFiller(normalized);
      const rawToks = cleaned.split(/[\s,،]+/).filter(Boolean);
      let shiftTime: { start: string; end: string } | null = null;
      for (const tok of rawToks) {
        const ns = cleanToken(tok);
        const tm = matchTimeToken(tok) ?? matchTimeToken(ns);
        const sm = tm ?? matchShiftType(ns) ?? matchShiftType(norm(tok));
        if (sm) { shiftTime = sm; break; }
      }
      // "פול שבוע" = Sun–Thu: morning + evening; Saturday: evening only (post-havdalah).
      // Ignore detected shift type — always generate the full grid.
      const WEEKDAYS = [0, 1, 2, 3, 4]; // Sunday–Thursday
      for (const dayIdx of WEEKDAYS) {
        const date = weekDates[dayIdx];
        if (!date) continue;
        // Morning
        shifts.push({
          employeeId: employee.id,
          employeeName: employee.name,
          date,
          dayName: HEBREW_DAY_NAMES[dayIdx],
          startTime: SHIFT_TIMES['בוקר'].start,
          endTime: SHIFT_TIMES['בוקר'].end,
          note: undefined,
          isExplicitMotzaei: false,
        });
        // Evening
        shifts.push({
          employeeId: employee.id,
          employeeName: employee.name,
          date,
          dayName: HEBREW_DAY_NAMES[dayIdx],
          startTime: SHIFT_TIMES['ערב'].start,
          endTime: SHIFT_TIMES['ערב'].end,
          note: undefined,
          isExplicitMotzaei: false,
        });
      }
      // Saturday — evening only, post-havdalah
      const satDate = weekDates[6];
      if (satDate) {
        const satStart = havdalahTime
          ? addMinutes(havdalahTime, MOTZAEI_OFFSET_MINUTES)
          : SHIFT_TIMES['ערב'].start;
        const satNote = havdalahTime
          ? `פתיחה ${MOTZAEI_OFFSET_MINUTES} דק׳ אחרי צאת שבת (${havdalahTime})`
          : undefined;
        shifts.push({
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
      continue; // done — skip normal token processing for this line
    }

    // ── Strip filler + Tokenise ─────────────────────────────────────────
    // 0. Normalize time ranges (e.g. "12:30 עד 18:00" → "12:30")
    //    Also detects "full day" ranges for auto-split
    // 1. Strip Hebrew filler words and prefix-hyphens from the line
    // 2. Split on whitespace / commas
    // 3. Filter out bare number fragments (e.g. "30", "00") left over
    //    from range tokenization that are not valid hour tokens
    // 4. Split Hebrew connectors (ו prefix, גם, וגם)
    // 5. Merge multi-word "מוצאי שבת" into a single token
    const { text: timeNormalized, fullDayStart, fullDayEnd } = normalizeTimeRanges(restLine);
    const cleanedLine = stripHebrewFiller(timeNormalized);
    const rawTokens = cleanedLine.split(/[\s,،]+/).filter(Boolean);
    // Fix 3a: Remove bare number fragments (1-2 digits) that are NOT valid hours (6-23)
    const filteredTokens = rawTokens.filter((tok) => {
      const stripped = tok.replace(/^[בולמ][-־]?/, '');
      if (/^\d{1,2}$/.test(stripped)) {
        const num = parseInt(stripped, 10);
        // Only keep if it's a valid hour for shifts (6-23)
        return num >= 6 && num <= 23;
      }
      return true;
    });
    const expanded = splitHebrewConnectors(filteredTokens);
    const tokens = mergeMotzaeiShabbat(expanded);

    let pendingDay: number | null = null;
    let pendingShift: { start: string; end: string } | null = null;
    let lastCommittedDay: number | null = null;

    // Internal helper: push a single shift entry (handles Shabbat time enforcement)
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

      // Enforce: Saturday shifts must not start before צאת שבת
      if (dayIdx === 6 && havdalahTime && !isExplicitMotzaei) {
        const motzaeiStart = addMinutes(havdalahTime, MOTZAEI_OFFSET_MINUTES);
        if (adjStart < motzaeiStart) {
          adjStart = motzaeiStart;
          adjNote = adjNote ?? `פתיחה ${MOTZAEI_OFFSET_MINUTES} דק׳ אחרי צאת שבת (${havdalahTime})`;
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
      // If the line detected a full-day range (fullDayStart is set) and the
      // shift being committed starts before 16:00 (morning side),
      // emit TWO shifts: actualStart–17:30 + 17:30–23:00.
      if (fullDayStart && !isExplicitMotzaei && shiftTime.start < '16:00') {
        pushShift(dayIdx, shiftTime.start, '17:30', note, false);
        // Use exact detected end time — avoids rounding e.g. 22:45 → 23:00
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
      // cleanToken: norm + recursive prefix stripping in one pass
      const ns = cleanToken(t);

      // Pure filler — skip silently
      if (IGNORE_LIST.has(ns) && !(ns in DAY_MAP) && !(ns in SHIFT_TIMES) && !MOTZAEI_TOKENS.has(ns) && matchTimeToken(t) === null) {
        continue;
      }

      if (MOTZAEI_TOKENS.has(ns)) {
        // Flush any complete pending pair first
        if (pendingDay !== null && pendingShift !== null) {
          commitPair(pendingDay, pendingShift);
        }
        pendingDay = null;
        pendingShift = null;
        // מוצ"ש = Saturday evening — use exact havdalah time (no offset), force day 6
        const motzaeiStart = havdalahTime ?? '17:30';
        const motzaeiNote = havdalahTime
          ? `משמרת מוצ״ש — צאת שבת ${havdalahTime}`
          : `פתיחה מוצ״ש`;
        commitPair(6, { start: motzaeiStart, end: '23:00' }, motzaeiNote, true);

      } else if (matchDay(ns) !== null) {

        if (pendingDay !== null && pendingShift !== null) {
          // Previous pair is complete — flush it
          commitPair(pendingDay, pendingShift);
          pendingDay = null;
          pendingShift = null;
        } else if (pendingDay !== null) {
          // Day without shift type — silently discard
          pendingDay = null;
        }

        const newDay = matchDay(ns)!;
        if (pendingShift !== null) {
          // Shift-before-day order (e.g. "בוקר שני")
          commitPair(newDay, pendingShift);
          pendingShift = null;
        } else {
          pendingDay = newDay;
        }

      } else {
        // ── Time token matching (e.g. "12:30", "ב-19:00") ──
        const timeMatch = matchTimeToken(t) ?? matchTimeToken(n);
        // ── Shift-type matching — try prefix-stripped form then fuzzy ──
        const shiftMatch = timeMatch ?? matchShiftType(ns) ?? matchShiftType(n);
        if (shiftMatch) {
  
          if (pendingDay !== null) {
            // Day-before-shift order (normal: "שני בוקר")
            commitPair(pendingDay, shiftMatch);
            pendingDay = null;
            pendingShift = null;
          } else if (lastCommittedDay !== null) {
            // No pending day but we have context from a previous shift on the
            // same line (e.g. "ראשון בוקר וגם ערב" — ערב inherits ראשון)
            commitPair(lastCommittedDay, shiftMatch);
            pendingShift = null;
          } else {
            pendingShift = shiftMatch;
          }
        }
      }
    }

    // Flush anything left after the last token
    if (pendingDay !== null && pendingShift !== null) {
      commitPair(pendingDay, pendingShift);
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
  const [showToast, setShowToast] = useState(false);
  const [doubleShiftToasts, setDoubleShiftToasts] = useState<string[]>([]);
  const [showDoubleToast, setShowDoubleToast] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
    setText('');
    setParsed(null);
    setImported(false);
    setShowToast(false);
    setShowDoubleToast(false);
    setDoubleShiftToasts([]);
  }, [onClose]);

  const handleParse = useCallback(async () => {
    setParsing(true);
    const employees = getEmployees();
    const weekDates = getWeekDates(weekId);
    // Fetch havdalah time for this week (cached after first call)
    const fridayDate = weekDates[5];
    const shabbatTimes = fridayDate ? await fetchShabbatTimes(fridayDate) : null;
    let result: ParseResult;
    if (!shabbatTimes) {
      result = parseText(text, employees, weekDates, null);
    } else {
      result = parseText(text, employees, weekDates, shabbatTimes.havdalah);
    }

    // Deduplicate within the batch only (same employee + day + slot appearing twice in the text).
    // Storage duplicates are handled at import time by replacing existing shifts.
    const batchSeen = new Set<string>();
    result.shifts = result.shifts.filter((s) => {
      const key = `${s.employeeId}:${s.date}:${getShiftSlot(s.startTime)}`;
      if (batchSeen.has(key)) return false;
      batchSeen.add(key);
      return true;
    });
    setParsed(result);
    setImported(false);
    setParsing(false);
  }, [text, weekId]);

  const handleImport = useCallback(() => {
    if (!parsed || parsed.shifts.length === 0) return;

    // ── Step 1: Remove existing shifts for every (employee, day) pair in this batch ──
    // This implements "re-import replaces" — importing the same employee+day twice
    // updates their schedule instead of creating duplicates.
    const affectedKeys = new Set(parsed.shifts.map((s) => `${s.employeeId}:${s.date}`));
    for (const ex of getShifts(weekId)) {
      if (affectedKeys.has(`${ex.employeeId}:${ex.date}`)) {
        removeShift(ex.id);
      }
    }

    // ── Step 2: Save all parsed shifts ──
    const doubleMessages: string[] = [];
    const batchSaved: { employeeId: string; date: string; startTime: string }[] = [];

    for (const s of parsed.shifts) {
      const slot = getShiftSlot(s.startTime);
      const otherSlotVal = slot === 'morning' ? 'evening' : 'morning';
      const batchOther = batchSaved.find(
        (b) => b.employeeId === s.employeeId && b.date === s.date && getShiftSlot(b.startTime) === otherSlotVal
      );
      // Also check newly-added shifts in storage for the other slot (from this same batch)
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

    // ── Step 3: Show double-shift toasts ──
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
      setParsed(null);
      setImported(false);
      setShowDoubleToast(false);
      setDoubleShiftToasts([]);
    }, 800);
  }, [parsed, weekId, onImported, onClose]);

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
              <div className="overflow-y-auto flex-1 p-4" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
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
                        {/* overflow-x-auto + touch-pan-x: horizontal scroll without
                            triggering pull-to-refresh on mobile */}
                        <div className="overflow-x-auto" style={{ touchAction: 'pan-x' }}>
                          <div className="flex flex-col gap-1.5 min-w-[280px]">
                            {parsed.shifts.map((s, i) => (
                              <div
                                key={i}
                                className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white text-sm min-w-[80px] truncate">
                                    {s.employeeName}
                                  </span>
                                  <span className="text-xs text-slate-600 dark:text-slate-300 shrink-0">
                                    {s.dayName} · {s.startTime}–{s.endTime}
                                  </span>
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
                      <motion.button
                        key="done"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                        disabled
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white font-bold rounded-xl min-h-[44px]"
                      >
                        <span>✓</span>
                        <span>יובאו {parsed.shifts.length} משמרות!</span>
                      </motion.button>
                    ) : (
                      <motion.button
                        key="import"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleImport}
                        className="w-full bg-green-600 text-white font-bold rounded-xl py-3 min-h-[44px] hover:bg-green-700 active:bg-green-800 transition-all duration-150"
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

      {/* Success toast — rendered outside the modal so it persists after modal closes */}
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
