'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getShifts, getEmployees, getConfirmations } from '@/lib/storage';
import { fetchShabbatTimes } from '@/lib/hebcal';
import type { ShabbatTimes } from '@/lib/hebcal';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import type { Shift, Employee, Confirmation } from '@/lib/types';

const HEBREW_DAYS = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
] as const;

function getWeekDates(weekId: string): string[] {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return [];
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1);
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

interface ShiftChipProps {
  shift: Shift;
  isConfirmed: boolean;
  isMotzaei?: boolean;
}

function ShiftChip({ shift, isConfirmed, isMotzaei }: ShiftChipProps) {
  return (
    <div
      className={`rounded-lg px-1.5 py-1 text-xs leading-tight ${
        isConfirmed
          ? 'bg-green-500/15 dark:bg-green-500/20'
          : 'bg-warm-200 dark:bg-slate-700/60'
      }`}
    >
      <div className="flex items-center gap-1 flex-wrap">
        {isConfirmed && (
          <span className="text-green-500 dark:text-green-400 text-[10px]">✓</span>
        )}
        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
          {shift.startTime}–{shift.endTime}
        </span>
        {isMotzaei && (
          <span className="text-[8px] bg-purple-500/20 text-purple-600 dark:text-purple-300 px-1 rounded font-bold">
            מוצ״ש
          </span>
        )}
      </div>
      {shift.role && (
        <div className="text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[80px]">
          {shift.role}
        </div>
      )}
    </div>
  );
}

interface WeekCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: string;
  weekLabel: string;
}

export default function WeekCalendarModal({
  isOpen,
  onClose,
  weekId,
  weekLabel,
}: WeekCalendarModalProps) {
  useBodyScrollLock(isOpen);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [shabbatTimes, setShabbatTimes] = useState<ShabbatTimes | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmployees(getEmployees());
    setShifts(getShifts(weekId));
    setConfirmations(getConfirmations(weekId));

    const weekDates = getWeekDates(weekId);
    const fridayDate = weekDates[5];
    if (fridayDate) fetchShabbatTimes(fridayDate).then(setShabbatTimes);
  }, [isOpen, weekId]);

  const dates = getWeekDates(weekId);
  const confirmationSet = new Set(confirmations.map((c) => `${c.shiftId}:${c.employeeId}`));

  // Build lookup: date+employeeId → shifts[]
  const shiftMap = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = `${shift.date}|${shift.employeeId}`;
    if (!shiftMap.has(key)) shiftMap.set(key, []);
    shiftMap.get(key)!.push(shift);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-950/90 flex flex-col"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col bg-warm-50 dark:bg-slate-900 rounded-t-3xl mt-auto max-h-[92vh]"
          >
            {/* Handle + Header */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-warm-200 dark:border-slate-700">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 bg-warm-300 dark:bg-slate-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">לוח שבועי</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{weekLabel}</span>
                  <button
                    onClick={onClose}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-warm-200 dark:hover:bg-slate-700 transition-colors"
                    aria-label="סגור"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-auto flex-1" style={{ touchAction: 'pan-x pan-y' }}>
              {employees.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">
                  אין עובדים. הוסף עובדים דרך תפריט הניהול.
                </p>
              ) : (
                <table className="border-collapse min-w-max w-full text-sm" dir="rtl">
                  <thead>
                    <tr>
                      {/* Employee name column header */}
                      <th className="sticky right-0 z-10 bg-warm-100 dark:bg-slate-800 border border-warm-200 dark:border-slate-700 px-3 py-2 text-right text-xs font-bold text-slate-500 dark:text-slate-400 min-w-[80px]">
                        עובד
                      </th>
                      {dates.map((date, i) => {
                        const isToday = date === todayStr;
                        const isFriday = i === 5;
                        const isSaturday = i === 6;
                        return (
                          <th
                            key={date}
                            className={`border border-warm-200 dark:border-slate-700 px-2 py-2 text-center min-w-[100px] ${
                              isFriday
                                ? 'bg-orange-50 dark:bg-orange-900/10'
                                : isSaturday
                                ? 'bg-purple-50 dark:bg-purple-900/10'
                                : isToday
                                ? 'bg-blue-500/10 dark:bg-blue-500/20'
                                : 'bg-warm-100 dark:bg-slate-800'
                            }`}
                          >
                            <div
                              className={`text-xs font-bold ${
                                isFriday
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : isSaturday
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : isToday
                                  ? 'text-blue-500'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {HEBREW_DAYS[i]}
                            </div>
                            <div
                              className={`text-xs ${
                                isToday ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {formatShortDate(date)}
                            </div>
                            {isFriday && shabbatTimes && (
                              <div className="text-[9px] text-orange-500 dark:text-orange-400 mt-0.5 leading-none">
                                🕯 {shabbatTimes.candleLighting}
                              </div>
                            )}
                            {isSaturday && shabbatTimes && (
                              <div className="text-[9px] text-purple-500 dark:text-purple-400 mt-0.5 leading-none">
                                ✨ {shabbatTimes.havdalah}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        {/* Sticky employee name */}
                        <td className="sticky right-0 z-10 bg-warm-50 dark:bg-slate-900 border border-warm-200 dark:border-slate-700 px-3 py-2 font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                          {emp.name}
                        </td>
                        {dates.map((date, i) => {
                          const dayShifts = (shiftMap.get(`${date}|${emp.id}`) ?? []).sort(
                            (a, b) => a.startTime.localeCompare(b.startTime)
                          );
                          const isToday = date === todayStr;
                          const isFriday = i === 5;
                          const isSaturday = i === 6;

                          const morningShifts = dayShifts.filter((s) => s.startTime < '16:00');
                          const eveningShifts = dayShifts.filter((s) => s.startTime >= '16:00');

                          return (
                            <td
                              key={date}
                              className={`border border-warm-200 dark:border-slate-700 px-1.5 py-1.5 align-top ${
                                isFriday
                                  ? 'bg-orange-50/50 dark:bg-orange-900/5'
                                  : isSaturday
                                  ? 'bg-purple-50/50 dark:bg-purple-900/5'
                                  : isToday
                                  ? 'bg-blue-500/5 dark:bg-blue-500/10'
                                  : ''
                              }`}
                            >
                              {/* Morning zone */}
                              <div className="pb-0.5">
                                <div className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mb-0.5">
                                  ☀ בוקר
                                </div>
                                {morningShifts.length === 0 ? (
                                  <div className="flex items-center justify-center h-5 text-slate-300 dark:text-slate-600 text-xs">
                                    —
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    {morningShifts.map((shift) => (
                                      <ShiftChip
                                        key={shift.id}
                                        shift={shift}
                                        isConfirmed={confirmationSet.has(`${shift.id}:${emp.id}`)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Divider */}
                              <div className="h-px bg-warm-200 dark:bg-slate-600 my-1" />

                              {/* Evening zone */}
                              <div className="pt-0.5">
                                <div className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5">
                                  🌙 ערב
                                </div>
                                {eveningShifts.length === 0 ? (
                                  <div className="flex items-center justify-center h-5 text-slate-300 dark:text-slate-600 text-xs">
                                    —
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    {eveningShifts.map((shift) => (
                                      <ShiftChip
                                        key={shift.id}
                                        shift={shift}
                                        isConfirmed={confirmationSet.has(`${shift.id}:${emp.id}`)}
                                        isMotzaei={
                                          isSaturday &&
                                          !!shabbatTimes &&
                                          shift.startTime >= shabbatTimes.havdalah
                                        }
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Legend */}
            <div className="flex-shrink-0 flex items-center flex-wrap gap-4 px-4 py-3 border-t border-warm-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40" />
                <span className="text-xs text-slate-500 dark:text-slate-400">אושר</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-warm-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-500 dark:text-slate-400">טרם אושר</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400">☀ בוקר</span>
                <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400">🌙 ערב</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-bold text-purple-600 dark:text-purple-300 bg-purple-500/20 px-1 rounded">מוצ״ש</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">אחרי צאת שבת</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
