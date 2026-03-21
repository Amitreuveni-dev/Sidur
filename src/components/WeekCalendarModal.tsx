'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getShifts, getEmployees, getConfirmations } from '@/lib/storage';
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

  useEffect(() => {
    if (!isOpen) return;
    setEmployees(getEmployees());
    setShifts(getShifts(weekId));
    setConfirmations(getConfirmations(weekId));
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
                        return (
                          <th
                            key={date}
                            className={`border border-warm-200 dark:border-slate-700 px-2 py-2 text-center min-w-[90px] ${
                              isToday
                                ? 'bg-blue-500/10 dark:bg-blue-500/20'
                                : 'bg-warm-100 dark:bg-slate-800'
                            }`}
                          >
                            <div className={`text-xs font-bold ${isToday ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'}`}>
                              {HEBREW_DAYS[i]}
                            </div>
                            <div className={`text-xs ${isToday ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                              {formatShortDate(date)}
                            </div>
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
                        {dates.map((date) => {
                          const dayShifts = shiftMap.get(`${date}|${emp.id}`) ?? [];
                          const isToday = date === todayStr;

                          return (
                            <td
                              key={date}
                              className={`border border-warm-200 dark:border-slate-700 px-1.5 py-1.5 align-top ${
                                isToday ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''
                              }`}
                            >
                              {dayShifts.length === 0 ? (
                                <span className="flex items-center justify-center h-8 text-slate-300 dark:text-slate-600 text-lg">—</span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {dayShifts
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                    .map((shift) => {
                                      const confirmed = confirmationSet.has(`${shift.id}:${emp.id}`);
                                      return (
                                        <div
                                          key={shift.id}
                                          className={`rounded-lg px-1.5 py-1 text-xs leading-tight ${
                                            confirmed
                                              ? 'bg-green-500/15 dark:bg-green-500/20'
                                              : 'bg-warm-200 dark:bg-slate-700/60'
                                          }`}
                                        >
                                          <div className="flex items-center gap-1">
                                            {confirmed && (
                                              <span className="text-green-500 dark:text-green-400 text-[10px]">✓</span>
                                            )}
                                            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                              {shift.startTime}–{shift.endTime}
                                            </span>
                                          </div>
                                          {shift.role && (
                                            <div className="text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[80px]">
                                              {shift.role}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
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
            <div className="flex-shrink-0 flex items-center gap-4 px-4 py-3 border-t border-warm-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40" />
                <span className="text-xs text-slate-500 dark:text-slate-400">אושר</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-warm-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-500 dark:text-slate-400">טרם אושר</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">אין משמרת</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
