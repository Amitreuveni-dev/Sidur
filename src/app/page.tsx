'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminGuard from '@/components/AdminGuard';
import WeatherWidget from '@/components/WeatherWidget';
import ManagerNote from '@/components/ManagerNote';
import WeekTimeline from '@/components/WeekTimeline';
import WhatsAppExport from '@/components/WhatsAppExport';
import WeekCalendarModal from '@/components/WeekCalendarModal';
import AIShiftSorter from '@/components/AIShiftSorter';
import ShiftModal from '@/components/ShiftModal';
import { useTheme } from '@/lib/themeContext';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import { getEmployees, addEmployee, removeEmployee, getShifts, clearWeekShifts } from '@/lib/storage';
import { formatWeekLabel } from '@/lib/weekLabel';
import type { Employee } from '@/lib/types';

function getCurrentWeekId(): string {
  const now = new Date();
  const year = now.getFullYear();

  // Calculate ISO week number
  const jan1 = new Date(year, 0, 1);
  const dayOfYear =
    Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const jan1Day = jan1.getDay() || 7; // Monday = 1
  const weekNum = Math.ceil((dayOfYear + jan1Day - 1) / 7);

  const paddedWeek = String(weekNum).padStart(2, '0');
  return `${year}-W${paddedWeek}`;
}

function getAdjacentWeekId(weekId: string, offset: number): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekId;

  let year = parseInt(match[1], 10);
  let week = parseInt(match[2], 10) + offset;

  // Handle year boundaries
  if (week < 1) {
    year -= 1;
    week = 52; // simplified, most years have 52 weeks
  } else if (week > 52) {
    year += 1;
    week = 1;
  }

  return `${year}-W${String(week).padStart(2, '0')}`;
}

export default function AdminDashboard() {
  const { theme, toggle } = useTheme();
  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [fabModalOpen, setFabModalOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAISorter, setShowAISorter] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEmployeePanel, setShowEmployeePanel] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Detect virtual keyboard by watching visualViewport resize
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const handleResize = () => {
      setKeyboardOpen(viewport.height < window.innerHeight * 0.75);
    };

    viewport.addEventListener('resize', handleResize);
    return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setEmployees(getEmployees());
  }, []);

  const handleAddEmployee = useCallback(() => {
    const name = newEmployeeName.trim();
    if (!name) return;
    addEmployee(name);
    setNewEmployeeName('');
    setEmployees(getEmployees());
  }, [newEmployeeName]);

  const handleRemoveEmployee = useCallback((id: string) => {
    removeEmployee(id);
    setEmployees(getEmployees());
  }, []);

  useBodyScrollLock(showEmployeePanel);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const weekShiftCount = getShifts(weekId).length;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey triggers re-read from localStorage
  const hasNoShifts = weekShiftCount === 0;

  const handleResetClick = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true);
      resetTimerRef.current = setTimeout(() => setConfirmReset(false), 4000);
    } else {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      clearWeekShifts(weekId);
      setConfirmReset(false);
      triggerRefresh();
    }
  }, [confirmReset, weekId, triggerRefresh]);

  // Reset confirm state whenever the week changes
  useEffect(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setConfirmReset(false);
  }, [weekId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  return (
    <AdminGuard>
      {(isAdmin, adminButtons) => (
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">סידור עבודה</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">ניו דלהי — צור הדסה</p>
              </div>
              {/* Theme Toggle */}
              <button
                onClick={toggle}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-warm-50 dark:bg-slate-800 hover:bg-warm-200 dark:hover:bg-slate-600 active:bg-warm-300 dark:active:bg-slate-700 shadow-lg transition-all duration-150"
                aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
              >
                <span className="text-xl">{theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span>
              </button>
              {/* Admin buttons — inline between theme toggle and weather */}
              {adminButtons}
            </div>
            <WeatherWidget />
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-4 bg-warm-50 dark:bg-slate-800 rounded-2xl p-3 shadow-sm dark:shadow-none">
            <button
              onClick={() => setWeekId(getAdjacentWeekId(weekId, -1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700/60 active:bg-warm-200 dark:active:bg-slate-700 text-slate-900 dark:text-white transition-all duration-150"
              aria-label="שבוע קודם"
            >
              <span className="text-xl">{'\u2192'}</span>
            </button>

            <div className="text-center">
              <span className="text-slate-900 dark:text-white font-bold text-sm leading-tight">{formatWeekLabel(weekId)}</span>
              {weekId === getCurrentWeekId() && (
                <span className="block text-xs text-blue-500 dark:text-blue-400 mt-0.5">השבוע</span>
              )}
            </div>

            <button
              onClick={() => setWeekId(getAdjacentWeekId(weekId, 1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700/60 active:bg-warm-200 dark:active:bg-slate-700 text-slate-900 dark:text-white transition-all duration-150"
              aria-label="שבוע הבא"
            >
              <span className="text-xl">{'\u2190'}</span>
            </button>
          </div>

          {/* Action bar (admin) */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 mb-4">
              <WhatsAppExport weekId={weekId} shiftCount={weekShiftCount} />
              <button
                onClick={() => setShowEmployeePanel(true)}
                className="min-h-[44px] flex items-center gap-1.5 bg-warm-300 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 hover:bg-warm-400 dark:hover:bg-slate-600 active:bg-slate-300 dark:active:bg-slate-600 active:scale-[0.97] font-bold text-sm transition-all duration-150"
              >
                <span>{'\uD83D\uDC65'}</span>
                <span>עובדים</span>
              </button>
              <button
                onClick={() => setShowCalendar(true)}
                className="min-h-[44px] flex items-center gap-1.5 bg-warm-300 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 hover:bg-warm-400 dark:hover:bg-slate-600 active:bg-slate-300 dark:active:bg-slate-600 active:scale-[0.97] font-bold text-sm transition-all duration-150"
              >
                <span>📅</span>
                <span>לוח</span>
              </button>
              <button
                onClick={() => setShowAISorter(true)}
                className="min-h-[44px] flex items-center gap-1.5 bg-warm-300 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 hover:bg-warm-400 dark:hover:bg-slate-600 active:bg-slate-300 dark:active:bg-slate-600 active:scale-[0.97] font-bold text-sm transition-all duration-150"
              >
                <span>🤖</span>
                <span>AI ייבוא</span>
              </button>
              <button
                onClick={handleResetClick}
                disabled={hasNoShifts}
                className={`min-h-[44px] flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold text-sm transition-all duration-200 ${
                  hasNoShifts
                    ? 'opacity-40 cursor-not-allowed bg-red-500/15 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : confirmReset
                      ? 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 active:scale-[0.97]'
                      : 'bg-red-500/15 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-500/25 dark:hover:bg-red-900/50 active:scale-[0.97]'
                }`}
                aria-label="איפוס משמרות השבוע"
              >
                <span>🗑️</span>
                <span>
                  {confirmReset
                    ? `למחוק ${weekShiftCount} משמרות?`
                    : 'איפוס שבוע'}
                </span>
              </button>
            </div>
          )}

          {/* Week Timeline */}
          <WeekTimeline key={refreshKey} weekId={weekId} isAdmin={isAdmin} />

          {/* Manager's Weekly Note — at the bottom */}
          <div className="mt-4">
            <ManagerNote weekId={weekId} isAdmin={isAdmin} />
          </div>

          {/* FAB - Add Shift (hidden when keyboard is open) */}
          {isAdmin && !keyboardOpen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setFabModalOpen(true)}
              className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] inset-x-0 mx-auto w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 flex items-center justify-center text-2xl hover:bg-blue-600 active:bg-blue-600 z-40 transition-shadow duration-150"
              aria-label="הוסף משמרת"
            >
              +
            </motion.button>
          )}

          {/* FAB Modal */}
          <ShiftModal
            isOpen={fabModalOpen}
            onClose={() => setFabModalOpen(false)}
            onSaved={triggerRefresh}
            weekId={weekId}
          />

          {/* AI Shift Sorter */}
          <AIShiftSorter
            isOpen={showAISorter}
            onClose={() => setShowAISorter(false)}
            weekId={weekId}
            onImported={triggerRefresh}
          />

          {/* Week Calendar Modal */}
          <WeekCalendarModal
            isOpen={showCalendar}
            onClose={() => setShowCalendar(false)}
            weekId={weekId}
            weekLabel={formatWeekLabel(weekId)}
            onSaved={triggerRefresh}
          />

          {/* Employee Management Panel */}
          <AnimatePresence>
            {showEmployeePanel && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70"
                onClick={() => setShowEmployeePanel(false)}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_e, info) => {
                    if (info.offset.y > 120 || info.velocity.y > 500) setShowEmployeePanel(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md bg-warm-50 dark:bg-slate-800 rounded-t-3xl overflow-hidden max-h-[80vh] flex flex-col"
                >
                  {/* Non-scrollable: handle bar + title */}
                  <div className="pt-6 px-6 flex-shrink-0">
                    <div className="flex justify-center mb-4">
                      <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">ניהול עובדים</h2>
                  </div>

                  {/* Scrollable content */}
                  <div className="overflow-y-auto flex-1 px-6 pb-8" style={{ touchAction: 'pan-y' }}>
                    {/* Add employee */}
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
                        placeholder="שם עובד חדש..."
                        className="flex-1 bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 min-h-[44px] outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button
                        onClick={handleAddEmployee}
                        disabled={!newEmployeeName.trim()}
                        className="bg-blue-500 text-white font-bold rounded-xl px-4 min-h-[44px] hover:bg-blue-600 active:bg-blue-700 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-blue-500 transition-all duration-150"
                      >
                        הוסף
                      </button>
                    </div>

                    {/* Employee list */}
                    <div className="flex flex-col gap-2">
                      {employees.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center justify-between bg-warm-200 dark:bg-slate-700/50 rounded-xl p-3"
                        >
                          <span className="text-slate-900 dark:text-white font-bold">{emp.name}</span>
                          <button
                            onClick={() => handleRemoveEmployee(emp.id)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-200 dark:hover:bg-slate-600 active:bg-warm-300 dark:active:bg-slate-600 transition-all duration-150"
                            aria-label={`הסר את ${emp.name}`}
                          >
                            <span className="text-red-500 dark:text-red-400">{'\u2715'}</span>
                          </button>
                        </div>
                      ))}
                      {employees.length === 0 && (
                        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                          אין עובדים. הוסף עובד ראשון למעלה.
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => setShowEmployeePanel(false)}
                      className="w-full mt-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-sm p-3 min-h-[44px] transition-colors duration-150"
                    >
                      סגור
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AdminGuard>
  );
}
