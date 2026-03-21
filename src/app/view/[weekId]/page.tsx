'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ManagerNote from '@/components/ManagerNote';
import EmployeeConfirm from '@/components/EmployeeConfirm';
import {
  getShifts,
  getEmployees,
  getConfirmations,
  getManagerNote,
} from '@/lib/storage';
import { fetchHolidays, getHolidaysForDate, isErevChag } from '@/lib/hebcal';
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
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatHebrewDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function EmployeeView() {
  const params = useParams();
  const weekId = params.weekId as string;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [holidays, setHolidays] = useState<Map<string, HolidayInfo[]>>(new Map());
  const [managerNote, setManagerNote] = useState('');
  const [confirmingShift, setConfirmingShift] = useState<Shift | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const reload = useCallback(() => {
    setShifts(getShifts(weekId));
    setEmployees(getEmployees());
    setConfirmations(getConfirmations(weekId));
    setManagerNote(getManagerNote(weekId));
  }, [weekId]);

  useEffect(() => {
    reload();
    fetchHolidays().then(setHolidays);
  }, [reload]);

  useEffect(() => {
    const stored = sessionStorage.getItem('sidur_viewer_id');
    setViewerId(stored);
    setSessionChecked(true);
  }, []);

  const handleIdentitySelect = useCallback((id: string) => {
    sessionStorage.setItem('sidur_viewer_id', id);
    setViewerId(id);
  }, []);

  const dates = getWeekDates(weekId);
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const confirmationMap = new Map(confirmations.map((c) => [`${c.shiftId}:${c.employeeId}`, c]));

  // Wait until sessionStorage is checked to avoid flashing the identity screen
  if (!sessionChecked) return null;

  // Identity screen — shown on first visit, cannot be skipped
  if (!viewerId) {
    return (
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">סידור עבודה</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">ניו דלהי — צור הדסה</p>
        </div>
        <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">מי אתה?</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
            בחר את שמך כדי להמשיך
          </p>
          <div className="flex flex-col gap-3">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleIdentitySelect(emp.id)}
                className="w-full bg-blue-500 text-white font-bold rounded-xl p-4 min-h-[44px] active:bg-blue-600 text-base"
              >
                {emp.name}
              </button>
            ))}
            {employees.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">טוען...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">סידור עבודה</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">ניו דלהי — צור הדסה — {weekId}</p>
      </div>

      {/* Manager Note (read-only) */}
      {managerNote && (
        <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 shadow-sm dark:shadow-none">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">הודעה מהמנהל</h3>
          <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{managerNote}</p>
        </div>
      )}

      {/* Days */}
      <div className="flex flex-col gap-3">
        {dates.map((date) => {
          const dayShifts = shifts
            .filter((s) => s.date === date)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const dayIndex = new Date(date + 'T00:00:00').getDay();
          const hebrewDay = HEBREW_DAYS[dayIndex];
          const formattedDate = formatHebrewDate(date);
          const isToday = new Date().toISOString().slice(0, 10) === date;
          const dayHolidays = getHolidaysForDate(date, holidays);
          const erevChag = isErevChag(date, holidays);

          return (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-none ${
                isToday ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {/* Day header */}
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">{hebrewDay}</h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">{formattedDate}</span>
                {isToday && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                    היום
                  </span>
                )}
              </div>

              {/* Holiday badges */}
              {dayHolidays.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {dayHolidays.map((h) => (
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

              {erevChag && (
                <div className="mb-2">
                  <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded-lg font-bold">
                    ערב חג - שעות מקוצרות
                  </span>
                </div>
              )}

              {/* Shifts */}
              <div className="flex flex-col gap-2">
                {dayShifts.map((shift) => {
                  const employee = employeeMap.get(shift.employeeId);
                  const isConfirmed = confirmationMap.has(
                    `${shift.id}:${shift.employeeId}`
                  );

                  return (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between bg-warm-200 dark:bg-slate-700/50 rounded-xl p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {employee?.name ?? 'לא ידוע'}
                          </span>
                          {isConfirmed && (
                            <span className="text-green-500 dark:text-green-400 flex-shrink-0">{'\u2713'}</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {shift.startTime} {'\u2013'} {shift.endTime}
                          {shift.role && (
                            <span className="text-slate-500 dark:text-slate-400 mr-2">
                              | {shift.role}
                            </span>
                          )}
                        </div>
                        {shift.note && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {shift.note}
                          </p>
                        )}
                      </div>

                      {!isConfirmed && (
                        <button
                          onClick={() => setConfirmingShift(shift)}
                          className="min-h-[44px] bg-green-600 text-white text-sm font-bold rounded-xl px-3 py-2 active:bg-green-700 flex-shrink-0 mr-2"
                        >
                          אשר משמרת
                        </button>
                      )}
                    </div>
                  );
                })}

                {dayShifts.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
                    אין משמרות
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Confirmation modal */}
      {confirmingShift && (
        <EmployeeConfirm
          shift={confirmingShift}
          isOpen={!!confirmingShift}
          onClose={() => setConfirmingShift(null)}
          onConfirmed={reload}
          lockedEmployeeId={viewerId ?? undefined}
        />
      )}
    </div>
  );
}
