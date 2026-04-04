'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmployees, saveShift, findDuplicateShift, findOtherSlotShift, getShiftSlot, getSlotLabel } from '@/lib/storage';
import { formatDoubleShiftWarning } from '@/lib/shiftValidation';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { fetchShabbatTimes } from '@/lib/hebcal';
import type { ShabbatTimes } from '@/lib/hebcal';
import QuickTemplates from './QuickTemplates';
import type { Employee, Shift } from '@/lib/types';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  weekId: string;
  editShift?: Shift | null;
  defaultDate?: string;
  /** Override the modal's z-index class (default: "z-[90]"). Useful when stacking on top of another modal. */
  zIndexClass?: string;
}

export default function ShiftModal({
  isOpen,
  onClose,
  onSaved,
  weekId,
  editShift,
  defaultDate,
  zIndexClass = 'z-[90]',
}: ShiftModalProps) {
  useBodyScrollLock(isOpen);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [role, setRole] = useState('');
  const [note, setNote] = useState('');
  const [shabbatTimes, setShabbatTimes] = useState<ShabbatTimes | null>(null);
  const [shabbatLoading, setShabbatLoading] = useState(false);
  const [storeOpenTime, setStoreOpenTime] = useState('');

  useEffect(() => {
    setEmployees(getEmployees());
  }, [isOpen]);

  useEffect(() => {
    if (editShift) {
      setEmployeeId(editShift.employeeId);
      setDate(editShift.date);
      setStartTime(editShift.startTime);
      setEndTime(editShift.endTime);
      setRole(editShift.role ?? '');
      setNote(editShift.note ?? '');
    } else {
      setEmployeeId('');
      setDate(defaultDate ?? '');
      setStartTime('');
      setEndTime('');
      setRole('');
      setNote('');
    }
  }, [editShift, defaultDate, isOpen]);

  // Fetch Shabbat times when date is Friday or Saturday
  useEffect(() => {
    if (!date) {
      setShabbatTimes(null);
      setStoreOpenTime('');
      return;
    }
    const d = new Date(date + 'T12:00:00');
    const dow = d.getDay(); // 5 = Friday, 6 = Saturday
    if (dow !== 5 && dow !== 6) {
      setShabbatTimes(null);
      setStoreOpenTime('');
      return;
    }
    const fridayDate = dow === 6
      ? new Date(d.getTime() - 86400000).toISOString().slice(0, 10)
      : date;
    setShabbatLoading(true);
    fetchShabbatTimes(fridayDate).then((times) => {
      setShabbatTimes(times);
      if (times && dow === 6) setStoreOpenTime(times.havdalah);
      setShabbatLoading(false);
    });
  }, [date]);

  const handleTemplateSelect = useCallback((start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!employeeId || !date || !startTime || !endTime) return;

    const shift: Shift = {
      id: editShift?.id ?? crypto.randomUUID(),
      weekId,
      date,
      employeeId,
      startTime,
      endTime,
      role: role || undefined,
      note: note || undefined,
    };

    saveShift(shift);
    onSaved();
    onClose();
  }, [employeeId, date, startTime, endTime, role, note, weekId, editShift, employees, onSaved, onClose]);

  // Slot-aware duplicate detection: same employee + same day + same slot
  const duplicateShift = (employeeId && date && startTime)
    ? findDuplicateShift(weekId, employeeId, date, startTime, editShift?.id)
    : undefined;
  const isDuplicate = !!duplicateShift;
  const duplicateSlotLabel = startTime ? getSlotLabel(getShiftSlot(startTime)) : '';

  // Different-slot same-day info warning (not blocking)
  const otherSlotExists = (employeeId && date && startTime)
    ? !!findOtherSlotShift(weekId, employeeId, date, startTime, editShift?.id)
    : false;

  const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const hebrewDayName = date ? HEBREW_DAYS[new Date(date + 'T12:00:00').getDay()] : '';
  const doubleShiftWarningText = (otherSlotExists && selectedEmployee && hebrewDayName)
    ? formatDoubleShiftWarning(selectedEmployee.name, `יום ${hebrewDayName}`)
    : '';

  const dow = date ? new Date(date + 'T12:00:00').getDay() : -1;
  const isFriday = dow === 5;
  const isSaturday = dow === 6;

  const shabbatError =
    isFriday && shabbatTimes && endTime && endTime > shabbatTimes.candleLighting
      ? `המשמרת חייבת להסתיים לפני כניסת שבת (${shabbatTimes.candleLighting})`
      : isSaturday && storeOpenTime && startTime && startTime < storeOpenTime
      ? `המשמרת חייבת להתחיל לאחר פתיחת החנות (${storeOpenTime})`
      : '';

  const isValid = !!(employeeId && date && startTime && endTime) && !shabbatError && !shabbatLoading && !isDuplicate;

  const inputClasses =
    'w-full bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 h-[44px] outline-none focus:ring-2 focus:ring-blue-500';
  const dateTimeInputClasses =
    'w-full bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl px-3 h-[40px] outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]';

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-black/70`}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-warm-50 dark:bg-slate-800 rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Static header: Save (left) + Title (center) + ✕ (right) */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-warm-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className="min-h-[36px] px-4 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 active:bg-blue-700 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-blue-500 disabled:active:bg-blue-500 disabled:active:scale-100 transition-all duration-150"
              >
                {editShift ? 'עדכן' : 'שמור'}
              </button>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editShift ? 'ערוך משמרת' : 'משמרת חדשה'}
              </h2>
              <button
                onClick={onClose}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-warm-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="סגור"
              >
                ✕
              </button>
            </div>

            {/* Scrollable: form fields */}
            <div className="overflow-y-auto flex-1 px-6 pt-4 pb-8" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
              <div className="flex flex-col gap-4">
                {/* Employee Select */}
                <div>
                  <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">עובד</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">בחר עובד...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                  {employees.length === 0 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      אין עובדים. הוסף עובדים דרך תפריט הניהול.
                    </p>
                  )}
                  {isDuplicate && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-bold">
                      עובד זה כבר משובץ למשמרת {duplicateSlotLabel} ביום זה
                    </p>
                  )}
                  <AnimatePresence>
                    {!isDuplicate && doubleShiftWarningText && (
                      <motion.div
                        key="double-shift-banner"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{
                          opacity: { duration: 0.2 },
                          height: { type: 'spring', damping: 28, stiffness: 350 },
                        }}
                        style={{ overflow: 'hidden' }}
                        className="mt-2 bg-amber-50 dark:bg-amber-900/15 border border-amber-300 dark:border-amber-600/40 border-r-4 border-r-amber-400 dark:border-r-amber-500 rounded-2xl px-4 py-3"
                      >
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                          {doubleShiftWarningText}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Date */}
                <div>
                  <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">תאריך</label>
                  <div className="h-[44px] overflow-hidden rounded-xl">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`${dateTimeInputClasses} !h-[44px]`}
                    />
                  </div>
                </div>

                {/* Shabbat candle lighting info (Friday) */}
                {isFriday && shabbatTimes && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 text-right -mt-2">
                    כניסת שבת: {shabbatTimes.candleLighting} — המשמרת חייבת להסתיים לפניה
                  </p>
                )}

                {/* Saturday store open time */}
                {isSaturday && (
                  <div>
                    <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">
                      חנות נפתחת בשעה {shabbatTimes && `(יציאת שבת: ${shabbatTimes.havdalah})`}
                    </label>
                    <input
                      type="time"
                      value={storeOpenTime}
                      onChange={(e) => setStoreOpenTime(e.target.value)}
                      className={`${dateTimeInputClasses} !h-[44px]`}
                    />
                  </div>
                )}

                {/* Quick Templates */}
                <div>
                  <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">תבניות מהירות</label>
                  <QuickTemplates onSelect={handleTemplateSelect} />
                </div>

                {/* Times row */}
                <div className="flex gap-8 justify-start">
                  <div className="w-[43%]">
                    <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">התחלה</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={dateTimeInputClasses}
                    />
                  </div>
                  <div className="w-[43%]">
                    <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">סיום</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={dateTimeInputClasses}
                    />
                  </div>
                </div>

                {/* Shabbat validation error */}
                {shabbatError && (
                  <p className="text-xs text-red-500 dark:text-red-400 text-right -mt-2">
                    {shabbatError}
                  </p>
                )}

                {/* Role */}
                <div>
                  <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">תפקיד (אופציונלי)</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="למשל: קופה, מטבח..."
                    className={`${inputClasses} placeholder:text-slate-400 dark:placeholder:text-slate-500`}
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">הערה (אופציונלי)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="הערה חופשית..."
                    className={`${inputClasses} placeholder:text-slate-400 dark:placeholder:text-slate-500`}
                  />
                </div>

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

</>
  );
}
