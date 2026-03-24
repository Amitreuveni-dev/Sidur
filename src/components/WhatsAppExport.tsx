'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getWeekData, getEmployees } from '@/lib/storage';
import type { Employee } from '@/lib/types';

const HEBREW_DAYS = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת',
] as const;

interface WhatsAppExportProps {
  weekId: string;
}

function formatDateRange(weekId: string): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekId;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1);
  monday.setDate(monday.getDate() + (week - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(sunday)} - ${fmt(saturday)}`;
}

export default function WhatsAppExport({ weekId }: WhatsAppExportProps) {
  const [copied, setCopied] = useState(false);

  const handleExport = useCallback(async () => {
    const weekData = getWeekData(weekId);
    const employees = getEmployees();
    const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

    const dateRange = formatDateRange(weekId);

    // Group shifts by date
    const shiftsByDate = new Map<string, typeof weekData.shifts>();
    for (const shift of weekData.shifts) {
      const existing = shiftsByDate.get(shift.date) ?? [];
      existing.push(shift);
      shiftsByDate.set(shift.date, existing);
    }

    // Build message
    let msg = `\uD83D\uDCCB סידור עבודה — שבוע ${dateRange}\n\n`;

    // Sort dates
    const sortedDates = [...shiftsByDate.keys()].sort();

    for (const date of sortedDates) {
      const d = new Date(date + 'T00:00:00');
      const dayName = HEBREW_DAYS[d.getDay()];
      const dayNum = d.getDate();
      const monthNum = d.getMonth() + 1;

      msg += `${dayName}, ${dayNum}/${monthNum}:\n`;

      const dayShifts = shiftsByDate.get(date) ?? [];
      dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (const shift of dayShifts) {
        const name = empMap.get(shift.employeeId)?.name ?? 'לא ידוע';
        msg += `\u2022 ${name} ${shift.startTime}-${shift.endTime}\n`;
      }

      msg += '\n';
    }

    if (sortedDates.length === 0) {
      msg += 'אין משמרות מתוכננות השבוע.\n\n';
    }

    const viewUrl = `${window.location.origin}/view/${weekId}`;
    msg += `\u2705 לאישור לחצו: ${viewUrl}`;

    if (weekData.managerNote) {
      msg += `\n\n\uD83D\uDCDD הערת מנהל:\n${weekData.managerNote}`;
    }

    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: prompt user
      prompt('העתק את ההודעה:', msg);
    }
  }, [weekId]);

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl px-4 py-2 hover:bg-green-700 active:bg-green-800 active:scale-[0.97] font-bold text-sm transition-all duration-150"
        aria-label="שתף בוואטסאפ"
      >
        <span>{'\uD83D\uDCE4'}</span>
        <span>שתף</span>
      </button>

      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 right-0 bg-green-500 text-white text-xs text-center rounded-lg py-2 px-3 whitespace-nowrap"
          >
            הועתק! {'\u2713'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
