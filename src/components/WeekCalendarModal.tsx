'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getShifts, getEmployees, getConfirmations, removeShift } from '@/lib/storage';
import { fetchShabbatTimes } from '@/lib/hebcal';
import type { ShabbatTimes } from '@/lib/hebcal';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import ShiftModal from './ShiftModal';
import ManagerNote from './ManagerNote';
import WeekExportView from './WeekExportView';
import type { Shift, Employee, Confirmation } from '@/lib/types';

// ───────────────────────────── Constants ─────────────────────────────

const HEBREW_DAYS = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
] as const;

// ───────────────────────────── Helpers ─────────────────────────────

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

// ───────────────────────────── Sub-components ─────────────────────────────

interface EmployeePillProps {
  name: string;
  variant: 'morning' | 'evening' | 'motzaei';
  isConfirmed: boolean;
  /** stagger animation delay in seconds */
  delay: number;
}

function EmployeePill({ name, variant, isConfirmed, delay }: EmployeePillProps) {
  const colorMap = {
    morning: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
    evening: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
    motzaei: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/20 dark:text-yellow-300 ring-1 ring-yellow-300/50 dark:ring-yellow-500/30',
  };

  const confirmedRing = isConfirmed ? 'ring-1 ring-green-400/60 dark:ring-green-500/40' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      className={`
        inline-flex items-center gap-0.5 px-2 py-0.5 text-xs rounded-full font-medium
        min-h-[24px] whitespace-nowrap select-none
        ${colorMap[variant]} ${confirmedRing}
      `}
      aria-label={name}
    >
      {isConfirmed && (
        <span className="text-green-500 dark:text-green-400 text-[10px]">&#10003;</span>
      )}
      {variant === 'motzaei' ? (
        <>
          <span className="text-[10px]">{name}</span>
          <span className="text-[8px] opacity-70">&#10024;</span>
        </>
      ) : (
        <span className="text-[10px]">{name}</span>
      )}
    </motion.div>
  );
}

interface AddButtonProps {
  onClick: () => void;
}

function AddButton({ onClick }: AddButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="
        inline-flex items-center justify-center w-7 h-7 rounded-full
        border border-dashed border-slate-300 dark:border-slate-600
        text-slate-400 dark:text-slate-500 hover:border-blue-400 hover:text-blue-400
        dark:hover:border-blue-500 dark:hover:text-blue-500
        transition-colors duration-150 text-sm font-bold
        min-w-[44px] min-h-[44px]
      "
      aria-label="הוסף משמרת"
    >
      +
    </button>
  );
}

// ───────────────────────────── Main Component ─────────────────────────────

interface WeekCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: string;
  weekLabel: string;
  onSaved?: () => void;
}

export default function WeekCalendarModal({
  isOpen,
  onClose,
  weekId,
  weekLabel,
  onSaved,
}: WeekCalendarModalProps) {
  useBodyScrollLock(isOpen);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [shabbatTimes, setShabbatTimes] = useState<ShabbatTimes | null>(null);
  const [exporting, setExporting] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Add-shift sub-modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<string | undefined>(undefined);

  const reloadData = useCallback(() => {
    setEmployees(getEmployees());
    setShifts(getShifts(weekId));
    setConfirmations(getConfirmations(weekId));
  }, [weekId]);

  useEffect(() => {
    if (!isOpen) return;
    reloadData();
    const weekDates = getWeekDates(weekId);
    const fridayDate = weekDates[5];
    if (fridayDate) fetchShabbatTimes(fridayDate).then(setShabbatTimes);
  }, [isOpen, weekId, reloadData]);

  useEffect(() => {
    setCanShare(
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function',
    );
  }, []);

  const dates = getWeekDates(weekId);
  const todayStr = new Date().toISOString().slice(0, 10);

  const confirmationSet = useMemo(
    () => new Set(confirmations.map((c) => `${c.shiftId}:${c.employeeId}`)),
    [confirmations],
  );

  // Employee name map: id → name
  const empNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) map.set(emp.id, emp.name);
    return map;
  }, [employees]);

  // Build shift-centric lookup: date → { morning: Shift[], evening: Shift[] }
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, { morning: Shift[]; evening: Shift[] }>();
    for (const date of dates) {
      map.set(date, { morning: [], evening: [] });
    }
    for (const shift of shifts) {
      const bucket = map.get(shift.date);
      if (!bucket) continue;
      if (shift.startTime < '16:00') {
        bucket.morning.push(shift);
      } else {
        bucket.evening.push(shift);
      }
    }
    // Sort by startTime within each bucket
    for (const bucket of map.values()) {
      bucket.morning.sort((a, b) => a.startTime.localeCompare(b.startTime));
      bucket.evening.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [shifts, dates]);

  const handleRemoveShift = useCallback(
    (shiftId: string) => {
      removeShift(shiftId);
      reloadData();
      onSaved?.();
    },
    [reloadData, onSaved],
  );

  const handleAddShift = useCallback((date: string) => {
    setAddModalDate(date);
    setAddModalOpen(true);
  }, []);

  const handleShiftSaved = useCallback(() => {
    reloadData();
    onSaved?.();
  }, [reloadData, onSaved]);

  const handleExportImage = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fdfaf6',
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `sidur-${weekId}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [weekId]);

  const handleShareImage = useCallback(async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fdfaf6',
        logging: false,
      });
      await new Promise<void>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) { resolve(); return; }
          const file = new File([blob], `sidur-${weekId}.png`, { type: 'image/png' });
          try {
            await navigator.share({ files: [file], title: `סידור ${weekLabel}` });
          } catch {
            // user cancelled
          }
          resolve();
        }, 'image/png');
      });
    } finally {
      setExporting(false);
    }
  }, [weekId, weekLabel]);

  // Determine if a Saturday shift is motzaei shabbat
  const isMotzaei = useCallback(
    (shift: Shift, dayIndex: number): boolean => {
      return dayIndex === 6 && !!shabbatTimes && shift.startTime >= shabbatTimes.havdalah;
    },
    [shabbatTimes],
  );

  // ───────── Render helpers ─────────

  function renderPills(shiftsArr: Shift[], variant: 'morning' | 'evening', dayIndex: number) {
    if (shiftsArr.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {shiftsArr.map((shift, idx) => {
          const motzaei = isMotzaei(shift, dayIndex);
          return (
            <EmployeePill
              key={shift.id}
              name={empNameMap.get(shift.employeeId) ?? '?'}
              variant={motzaei ? 'motzaei' : variant}
              isConfirmed={confirmationSet.has(`${shift.id}:${shift.employeeId}`)}
              delay={idx * 0.04}
            />
          );
        })}
      </div>
    );
  }

  function renderEmptyState(date: string, isFriday: boolean, placeholderText?: string) {
    if (isFriday && placeholderText) {
      return (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
          {placeholderText}
        </span>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[28px] border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
        <AddButton onClick={() => handleAddShift(date)} />
      </div>
    );
  }

  // ───────── Main render ─────────

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="week-calendar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70"
            onClick={onClose}
          >
            <motion.div
              key="week-calendar-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) onClose();
              }}
              className="w-full bg-warm-50 dark:bg-slate-900 rounded-t-2xl overflow-hidden max-h-[90vh] h-[90vh] flex flex-col"
            >
              {/* ───── Handle + Header ───── */}
              <div className="flex-shrink-0 px-4 pt-6 pb-3 border-b border-warm-200 dark:border-slate-700">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-1.5 bg-warm-300 dark:bg-slate-600 rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    לוח שבועי
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{weekLabel}</span>
                    <button
                      onClick={handleExportImage}
                      disabled={exporting}
                      className="min-h-[36px] min-w-[44px] flex items-center justify-center gap-1 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:scale-95 transition-all duration-150 disabled:opacity-50 px-2"
                      aria-label="שמור כתמונה"
                    >
                      {exporting ? '⏳' : '🖼️'}
                      <span className="hidden sm:inline">{exporting ? 'שומר...' : 'תמונה'}</span>
                    </button>
                    {canShare && (
                      <button
                        onClick={handleShareImage}
                        disabled={exporting}
                        className="min-h-[36px] min-w-[44px] flex items-center justify-center gap-1 rounded-lg text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 active:scale-95 transition-all duration-150 disabled:opacity-50 px-2"
                        aria-label="שתף תמונה"
                      >
                        📤
                        <span className="hidden sm:inline">שתף</span>
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-warm-200 dark:hover:bg-slate-700 transition-colors"
                      aria-label="סגור"
                    >
                      &#10005;
                    </button>
                  </div>
                </div>
              </div>

              {/* ───── Scrollable grid area ───── */}
              <div
                className="overflow-y-auto overflow-x-auto flex-1 overscroll-y-contain"
                style={{ touchAction: 'pan-x pan-y' }}
              >
                {employees.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">
                    אין עובדים. הוסף עובדים דרך תפריט הניהול.
                  </p>
                ) : (
                  <div
                    dir="rtl"
                    className="
                      grid min-w-[640px]
                      grid-cols-[64px_repeat(7,minmax(80px,1fr))]
                      grid-rows-[auto_auto_auto]
                      text-xs
                    "
                  >
                    {/* ═══════ ROW 1: Headers ═══════ */}

                    {/* Sidebar: label cell — sticky right (RTL) + sticky top */}
                    <div className="sticky end-0 top-0 z-30 bg-warm-100 dark:bg-slate-800 border border-warm-200 dark:border-slate-700 flex items-center justify-center px-1 py-2">
                      <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] text-center leading-tight">
                        יום / עובד
                      </span>
                    </div>

                    {/* Day header cells */}
                    {dates.map((date, i) => {
                      const isToday = date === todayStr;
                      const isFriday = i === 5;
                      const isSaturday = i === 6;

                      let bgClass = 'bg-warm-100 dark:bg-slate-800';
                      if (isFriday) bgClass = 'bg-amber-100/80 dark:bg-amber-900/20';
                      else if (isSaturday) bgClass = 'bg-purple-100/80 dark:bg-purple-900/20';
                      else if (isToday) bgClass = 'bg-blue-500/10 dark:bg-blue-500/20';

                      return (
                        <div
                          key={`hdr-${date}`}
                          className={`sticky top-0 z-20 border border-warm-200 dark:border-slate-700 px-1 py-2 text-center ${bgClass}`}
                        >
                          <div
                            className={`font-bold text-xs ${
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
                            className={`text-[10px] ${
                              isToday ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {formatShortDate(date)}
                          </div>

                          {/* Friday candle lighting */}
                          {isFriday && (
                            <div className="mt-0.5 leading-none">
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                                &#128367;&#65039;
                              </div>
                              {shabbatTimes && (
                                <div className="text-[8px] text-amber-500 dark:text-amber-500 mt-0.5">
                                  {shabbatTimes.candleLighting}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Saturday havdalah */}
                          {isSaturday && (
                            <div className="mt-0.5 leading-none">
                              <div className="text-[9px] text-purple-600 dark:text-purple-400 font-bold">
                                &#10024;
                              </div>
                              {shabbatTimes && (
                                <div className="text-[8px] text-purple-500 dark:text-purple-400 mt-0.5">
                                  {shabbatTimes.havdalah}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* ═══════ ROW 2: Morning (בוקר) ═══════ */}

                    {/* Sidebar label */}
                    <div className="sticky end-0 z-20 bg-amber-50 dark:bg-amber-950/20 border border-warm-200 dark:border-slate-700 flex items-center justify-center px-1 py-2">
                      <span className="font-bold text-amber-700 dark:text-amber-400 text-[10px] text-center leading-tight">
                        &#9728; בוקר
                      </span>
                    </div>

                    {/* Morning cells */}
                    {dates.map((date, i) => {
                      const isFriday = i === 5;
                      const isSaturday = i === 6;
                      const bucket = shiftsByDate.get(date);
                      const morningShifts = bucket?.morning ?? [];

                      // On Saturday, all shifts are evening (post-havdalah), so morning is always empty
                      const effectiveShifts = isSaturday ? [] : morningShifts;

                      const bgClass = isFriday
                        ? 'bg-amber-50/60 dark:bg-amber-950/10'
                        : isSaturday
                        ? 'bg-purple-50/40 dark:bg-purple-950/10'
                        : 'bg-orange-50/30 dark:bg-slate-800/40';

                      return (
                        <div
                          key={`morning-${date}`}
                          className={`border border-warm-200 dark:border-slate-700 px-1.5 py-2 min-h-[48px] ${bgClass}`}
                        >
                          {isFriday ? (
                            <div className="flex flex-col items-center justify-center h-full gap-0.5">
                              <span className="text-sm">&#128367;&#65039;</span>
                              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                שבת שלום
                              </span>
                            </div>
                          ) : isSaturday ? (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-[9px] text-purple-400 dark:text-purple-500 italic">
                                שבת
                              </span>
                            </div>
                          ) : effectiveShifts.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {renderPills(effectiveShifts, 'morning', i)}
                              <AddButton onClick={() => handleAddShift(date)} />
                            </div>
                          ) : (
                            renderEmptyState(date, false)
                          )}
                        </div>
                      );
                    })}

                    {/* ═══════ ROW 3: Evening (ערב) ═══════ */}

                    {/* Sidebar label */}
                    <div className="sticky end-0 z-20 bg-indigo-50 dark:bg-indigo-950/20 border border-warm-200 dark:border-slate-700 flex items-center justify-center px-1 py-2">
                      <span className="font-bold text-indigo-700 dark:text-indigo-400 text-[10px] text-center leading-tight">
                        &#127769; ערב
                      </span>
                    </div>

                    {/* Evening cells */}
                    {dates.map((date, i) => {
                      const isFriday = i === 5;
                      const isSaturday = i === 6;
                      const bucket = shiftsByDate.get(date);
                      const eveningShifts = bucket?.evening ?? [];

                      // On Saturday, combine morning + evening into this row (all are post-havdalah)
                      const saturdayAllShifts = isSaturday
                        ? [...(bucket?.morning ?? []), ...eveningShifts].sort((a, b) =>
                            a.startTime.localeCompare(b.startTime),
                          )
                        : eveningShifts;

                      const effectiveShifts = isSaturday ? saturdayAllShifts : eveningShifts;

                      const bgClass = isFriday
                        ? 'bg-amber-50/40 dark:bg-amber-950/5'
                        : isSaturday
                        ? 'bg-purple-50/60 dark:bg-purple-950/15'
                        : 'bg-indigo-50/30 dark:bg-slate-800/60';

                      return (
                        <div
                          key={`evening-${date}`}
                          className={`border border-warm-200 dark:border-slate-700 px-1.5 py-2 min-h-[48px] ${bgClass}`}
                        >
                          {isFriday ? (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-[9px] text-amber-500 dark:text-amber-600 italic">
                                מנוחה
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* Saturday havdalah subtitle */}
                              {isSaturday && shabbatTimes && (
                                <div className="text-[8px] text-purple-500 dark:text-purple-400 font-bold mb-1 text-center">
                                  &#10024; מוצ&quot;ש {shabbatTimes.havdalah}
                                </div>
                              )}
                              {effectiveShifts.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {renderPills(effectiveShifts, 'evening', i)}
                                  <AddButton onClick={() => handleAddShift(date)} />
                                </div>
                              ) : (
                                renderEmptyState(date, false)
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* ───── Manager's Note — outside scroll, full width ───── */}
              <div className="flex-shrink-0 w-full max-w-2xl mx-auto px-4 py-3 border-t border-warm-200 dark:border-slate-700">
                <ManagerNote weekId={weekId} isAdmin={true} />
              </div>

              {/* ───── Legend ───── */}
              <div className="flex-shrink-0 flex items-center flex-wrap gap-4 px-4 py-3 border-t border-warm-200 dark:border-slate-700" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300/60" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">בוקר</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-300/60" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">ערב</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-100 dark:bg-yellow-400/20 border border-yellow-300/60" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">מוצ&quot;ש</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">אושר</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───── Hidden export view — captured by html2canvas ───── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <WeekExportView
          ref={exportRef}
          dates={dates}
          shifts={shifts}
          employees={employees}
          weekLabel={weekLabel}
          candleLighting={shabbatTimes?.candleLighting}
          havdalah={shabbatTimes?.havdalah}
        />
      </div>

      {/* ───── Embedded ShiftModal for add-shift flow (stacked above calendar z-[100]) ───── */}
      <ShiftModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSaved={handleShiftSaved}
        weekId={weekId}
        defaultDate={addModalDate}
        zIndexClass="z-[110]"
      />
    </>
  );
}
