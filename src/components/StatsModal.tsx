'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getShifts, getEmployees } from '@/lib/storage';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import type { Shift, Employee } from '@/lib/types';

// ───────────────────────────── Helpers ─────────────────────────────

function shiftHours(s: Shift): number {
  const [sh, sm] = s.startTime.split(':').map(Number);
  const [eh, em] = s.endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60; // overnight
  return (end - start) / 60;
}

function getCurrentWeekId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const jan1Day = jan1.getDay() || 7;
  const weekNum = Math.ceil((dayOfYear + jan1Day - 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

type Period = 'week' | 'month' | 'all';

interface EmployeeStats {
  employee: Employee;
  shifts: number;
  hours: number;
}

// ───────────────────────────── Component ─────────────────────────────

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsModal({ isOpen, onClose }: StatsModalProps) {
  useBodyScrollLock(isOpen);
  const [period, setPeriod] = useState<Period>('month');

  const stats: EmployeeStats[] = useMemo(() => {
    if (!isOpen) return [];
    const employees = getEmployees();
    const allShifts = getShifts(); // no weekId = all shifts

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentWeekId = getCurrentWeekId();

    const filtered = allShifts.filter((s) => {
      if (period === 'week') return s.weekId === currentWeekId;
      if (period === 'month') return s.date.startsWith(monthPrefix);
      return true;
    });

    return employees
      .map((emp) => {
        const empShifts = filtered.filter((s) => s.employeeId === emp.id);
        const hours = empShifts.reduce((acc, s) => acc + shiftHours(s), 0);
        return { employee: emp, shifts: empShifts.length, hours };
      })
      .filter((s) => s.shifts > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [isOpen, period]);

  const totalHours = stats.reduce((acc, s) => acc + s.hours, 0);
  const totalShifts = stats.reduce((acc, s) => acc + s.shifts, 0);

  const periodLabel: Record<Period, string> = {
    week: 'שבוע נוכחי',
    month: 'חודש נוכחי',
    all: 'כל הזמן',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="stats-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70"
          onClick={onClose}
        >
          <motion.div
            key="stats-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-warm-50 dark:bg-slate-900 rounded-t-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Handle + Header */}
            <div className="flex-shrink-0 px-4 pt-6 pb-3 border-b border-warm-200 dark:border-slate-700">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1.5 bg-warm-300 dark:bg-slate-600 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  📊 סטטיסטיקות שעות
                </h2>
                <button
                  onClick={onClose}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-warm-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label="סגור"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Period Tabs */}
            <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-b border-warm-200 dark:border-slate-700">
              {(['week', 'month', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 min-h-[40px] rounded-xl text-sm font-bold transition-all duration-150 ${
                    period === p
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-warm-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-warm-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {stats.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">
                  אין נתונים לתקופה זו
                </p>
              ) : (
                <div dir="rtl">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_56px_64px] gap-2 px-3 pb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <span>עובד</span>
                    <span className="text-center">משמרות</span>
                    <span className="text-center">שעות</span>
                  </div>

                  {/* Rows */}
                  <div className="flex flex-col gap-2">
                    {stats.map(({ employee, shifts, hours }, idx) => (
                      <motion.div
                        key={employee.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="grid grid-cols-[1fr_56px_64px] gap-2 items-center bg-warm-100 dark:bg-slate-800 rounded-xl px-3 py-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">
                            {employee.role === 'manager' ? '⭐' : '👤'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                            {employee.name}
                          </span>
                          {employee.role === 'manager' && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-bold flex-shrink-0">
                              מנהל
                            </span>
                          )}
                        </div>
                        <span className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">
                          {shifts}
                        </span>
                        <div className="text-center">
                          <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                            {hours % 1 === 0 ? hours : hours.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 mr-0.5">ש׳</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Totals footer */}
            {stats.length > 0 && (
              <div
                className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-warm-200 dark:border-slate-700 bg-warm-100 dark:bg-slate-800/60"
                style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
                dir="rtl"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">סה״כ משמרות:</span>
                  <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{totalShifts}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">סה״כ שעות:</span>
                  <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                    {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">ש׳</span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
