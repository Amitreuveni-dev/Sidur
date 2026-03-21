'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmployees, saveShift } from '@/lib/storage';
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
}

export default function ShiftModal({
  isOpen,
  onClose,
  onSaved,
  weekId,
  editShift,
  defaultDate,
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
  }, [employeeId, date, startTime, endTime, role, note, weekId, editShift, onSaved, onClose]);

  const dow = date ? new Date(date + 'T12:00:00').getDay() : -1;
  const isFriday = dow === 5;
  const isSaturday = dow === 6;

  const shabbatError =
    isFriday && shabbatTimes && endTime && endTime > shabbatTimes.candleLighting
      ? `המשמרת חייבת להסתיים לפני כניסת שבת (${shabbatTimes.candleLighting})`
      : isSaturday && storeOpenTime && startTime && startTime < storeOpenTime
      ? `המשמרת חייבת להתחיל לאחר פתיחת החנות (${storeOpenTime})`
      : '';

  const isValid = !!(employeeId && date && startTime && endTime) && !shabbatError && !shabbatLoading;

  const inputClasses =
    'w-full bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 h-[44px] outline-none focus:ring-2 focus:ring-blue-500';
  const dateTimeInputClasses =
    'w-full bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl px-3 h-[40px] outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_event, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-warm-50 dark:bg-slate-800 rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Non-scrollable: handle bar + title */}
            <div className="pt-6 px-6 flex-shrink-0">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1.5 bg-warm-300 dark:bg-slate-600 rounded-full" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                {editShift ? 'ערוך משמרת' : 'משמרת חדשה'}
              </h2>
            </div>

            {/* Scrollable: form fields + submit */}
            <div className="overflow-y-auto flex-1 px-6 pb-8" style={{ touchAction: 'pan-y' }}>
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

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!isValid}
                  className="w-full bg-blue-500 text-white font-bold rounded-xl p-4 min-h-[44px] hover:bg-blue-600 active:bg-blue-700 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-blue-500 disabled:active:bg-blue-500 disabled:active:scale-100 mt-2 transition-all duration-150"
                >
                  {editShift ? 'עדכן משמרת' : 'הוסף משמרת'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
