'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminGuard from '@/components/AdminGuard';
import WeatherWidget from '@/components/WeatherWidget';
import ManagerNote from '@/components/ManagerNote';
import WeekTimeline from '@/components/WeekTimeline';
import WhatsAppExport from '@/components/WhatsAppExport';
import ShiftModal from '@/components/ShiftModal';
import { getEmployees, addEmployee, removeEmployee } from '@/lib/storage';
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
  const [weekId, setWeekId] = useState(getCurrentWeekId());
  const [fabModalOpen, setFabModalOpen] = useState(false);
  const [showEmployeePanel, setShowEmployeePanel] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setEmployees(getEmployees());
  }, [showEmployeePanel]);

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

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <AdminGuard>
      {(isAdmin) => (
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">סידור עבודה</h1>
              <p className="text-sm text-slate-400">ניו דלהי — צור הדסה</p>
            </div>
            <WeatherWidget />
          </div>

          {/* Manager Note */}
          <ManagerNote weekId={weekId} isAdmin={isAdmin} />

          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-4 bg-slate-800 rounded-2xl p-3">
            <button
              onClick={() => setWeekId(getAdjacentWeekId(weekId, -1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg active:bg-slate-700 text-white"
              aria-label="שבוע קודם"
            >
              <span className="text-xl">→</span>
            </button>

            <div className="text-center">
              <span className="text-white font-bold text-sm leading-tight">{formatWeekLabel(weekId)}</span>
              {weekId === getCurrentWeekId() && (
                <span className="block text-xs text-blue-400 mt-0.5">השבוע</span>
              )}
            </div>

            <button
              onClick={() => setWeekId(getAdjacentWeekId(weekId, 1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg active:bg-slate-700 text-white"
              aria-label="שבוע הבא"
            >
              <span className="text-xl">←</span>
            </button>
          </div>

          {/* Action bar (admin) */}
          {isAdmin && (
            <div className="flex gap-2 mb-4">
              <WhatsAppExport weekId={weekId} />
              <button
                onClick={() => setShowEmployeePanel(true)}
                className="min-h-[44px] flex items-center gap-2 bg-slate-700 text-white rounded-xl px-4 py-2 active:bg-slate-600 font-bold text-sm"
              >
                <span>👥</span>
                <span>עובדים</span>
              </button>
            </div>
          )}

          {/* Week Timeline */}
          <WeekTimeline key={refreshKey} weekId={weekId} isAdmin={isAdmin} />

          {/* FAB - Add Shift */}
          {isAdmin && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setFabModalOpen(true)}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center text-2xl active:bg-blue-600 z-40"
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
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md bg-slate-800 rounded-t-3xl p-6 pb-8 max-h-[80vh] overflow-y-auto"
                >
                  {/* Handle bar */}
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
                  </div>

                  <h2 className="text-lg font-bold text-white mb-4">ניהול עובדים</h2>

                  {/* Add employee */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
                      placeholder="שם עובד חדש..."
                      className="flex-1 bg-slate-700 text-white rounded-xl p-3 min-h-[44px] outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                    />
                    <button
                      onClick={handleAddEmployee}
                      disabled={!newEmployeeName.trim()}
                      className="bg-blue-500 text-white font-bold rounded-xl px-4 min-h-[44px] active:bg-blue-600 disabled:opacity-40"
                    >
                      הוסף
                    </button>
                  </div>

                  {/* Employee list */}
                  <div className="flex flex-col gap-2">
                    {employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center justify-between bg-slate-700/50 rounded-xl p-3"
                      >
                        <span className="text-white font-bold">{emp.name}</span>
                        <button
                          onClick={() => handleRemoveEmployee(emp.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg active:bg-slate-600"
                          aria-label={`הסר את ${emp.name}`}
                        >
                          <span className="text-red-400">✕</span>
                        </button>
                      </div>
                    ))}
                    {employees.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        אין עובדים. הוסף עובד ראשון למעלה.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setShowEmployeePanel(false)}
                    className="w-full mt-4 text-slate-400 text-sm p-3 min-h-[44px]"
                  >
                    סגור
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AdminGuard>
  );
}
