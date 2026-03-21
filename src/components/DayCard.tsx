'use client';

import { motion, AnimatePresence } from 'framer-motion';
import ShiftRow from './ShiftRow';
import type { Shift, Employee, Confirmation, HolidayInfo } from '@/lib/types';

const HEBREW_DAYS = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת',
] as const;

interface DayCardProps {
  date: string; // "YYYY-MM-DD"
  shifts: Shift[];
  employees: Employee[];
  confirmations: Confirmation[];
  holidays: HolidayInfo[];
  isErevChag: boolean;
  isAdmin: boolean;
  onEditShift?: (shift: Shift) => void;
  onDeleteShift?: (shiftId: string) => void;
  onAddShift?: (date: string) => void;
  onCancelConfirm?: (shiftId: string, employeeId: string) => void;
}

function formatHebrewDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${day}/${month}`;
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay();
}

export default function DayCard({
  date,
  shifts,
  employees,
  confirmations,
  holidays,
  isErevChag,
  isAdmin,
  onEditShift,
  onDeleteShift,
  onAddShift,
  onCancelConfirm,
}: DayCardProps) {
  const dayIndex = getDayOfWeek(date);
  const hebrewDay = HEBREW_DAYS[dayIndex];
  const formattedDate = formatHebrewDate(date);
  const isToday = new Date().toISOString().slice(0, 10) === date;

  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const confirmationMap = new Map(confirmations.map((c) => [c.shiftId, c]));

  // Sort shifts by start time
  const sortedShifts = [...shifts].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-none ${
        isToday ? 'ring-2 ring-blue-500' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">{hebrewDay}</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">{formattedDate}</span>
          {isToday && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
              היום
            </span>
          )}
        </div>

        {isAdmin && onAddShift && (
          <button
            onClick={() => onAddShift(date)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700/60 active:bg-warm-200 dark:active:bg-slate-700 transition-all duration-150"
            aria-label="הוסף משמרת ליום זה"
          >
            <span className="text-blue-500 dark:text-blue-400 text-xl">+</span>
          </button>
        )}
      </div>

      {/* Holiday badges */}
      {holidays.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {holidays.map((h) => (
            <span
              key={h.name}
              className={`text-xs px-2 py-1 rounded-lg font-bold ${
                h.isYomTov
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-500/20 text-orange-600 dark:text-orange-300'
              }`}
            >
              {h.isYomTov ? 'חג' : ''} {h.hebrew}
            </span>
          ))}
        </div>
      )}

      {isErevChag && (
        <div className="mb-2">
          <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded-lg font-bold">
            ערב חג - שעות מקוצרות
          </span>
        </div>
      )}

      {/* Shifts */}
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {sortedShifts.map((shift) => (
            <ShiftRow
              key={shift.id}
              shift={shift}
              employee={employeeMap.get(shift.employeeId)}
              confirmation={confirmationMap.get(shift.id)}
              isAdmin={isAdmin}
              onEdit={() => onEditShift?.(shift)}
              onDelete={() => onDeleteShift?.(shift.id)}
              onCancelConfirm={() => onCancelConfirm?.(shift.id, shift.employeeId)}
            />
          ))}
        </AnimatePresence>

        {sortedShifts.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
            אין משמרות
          </p>
        )}
      </div>
    </motion.div>
  );
}
