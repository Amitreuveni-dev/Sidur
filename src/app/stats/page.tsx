'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getShifts, getEmployees } from '@/lib/storage';
import type { Shift, Employee } from '@/lib/types';

type ViewMode = 'week' | 'month';

const HEBREW_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

function shiftHours(s: Shift): number {
  const [sh, sm] = s.startTime.split(':').map(Number);
  const [eh, em] = s.endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
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

function getAdjacentWeekId(weekId: string, offset: number): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekId;
  let year = parseInt(match[1], 10);
  let week = parseInt(match[2], 10) + offset;
  if (week < 1) { year -= 1; week = 52; }
  else if (week > 52) { year += 1; week = 1; }
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function weekIdLabel(weekId: string): string {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekId;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1);
  monday.setDate(monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return `${sunday.getDate()}/${sunday.getMonth()+1} – ${saturday.getDate()}/${saturday.getMonth()+1}`;
}

interface EmployeeStats {
  employee: Employee;
  shifts: number;
  hours: number;
}

export default function StatsPage() {
  const router = useRouter();
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedWeekId, setSelectedWeekId] = useState(getCurrentWeekId());

  const currentWeekId = getCurrentWeekId();
  const isCurrentWeek = selectedWeekId === currentWeekId;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  const stats: EmployeeStats[] = useMemo(() => {
    const employees = getEmployees();
    const allShifts = getShifts();
    const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    const filtered = allShifts.filter((s) => {
      if (viewMode === 'week') return s.weekId === selectedWeekId;
      return s.date.startsWith(monthPrefix);
    });

    return employees
      .map((emp) => {
        const empShifts = filtered.filter((s) => s.employeeId === emp.id);
        const hours = empShifts.reduce((acc, s) => acc + shiftHours(s), 0);
        return { employee: emp, shifts: empShifts.length, hours };
      })
      .filter((s) => s.shifts > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [viewMode, selectedYear, selectedMonth, selectedWeekId]);

  const maxHours = stats.length > 0 ? stats[0].hours : 1;
  const totalHours = stats.reduce((acc, s) => acc + s.hours, 0);
  const totalShifts = stats.reduce((acc, s) => acc + s.shifts, 0);

  function goToPrevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  }
  function goToNextMonth() {
    if (isCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  }

  return (
    <div className="min-h-screen bg-warm-100 dark:bg-slate-900 p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/')}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-warm-50 dark:bg-slate-800 text-slate-700 dark:text-white hover:bg-warm-200 dark:hover:bg-slate-700 transition-colors text-xl font-bold"
          aria-label="חזרה לדף הראשי"
        >
          →
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📊 סטטיסטיקות</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">ניו דלהי — צור הדסה</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {(['month', 'week'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-all duration-150 ${
              viewMode === mode
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-warm-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-warm-300 dark:hover:bg-slate-600'
            }`}
          >
            {mode === 'month' ? 'חודש' : 'שבוע'}
          </button>
        ))}
      </div>

      {/* Month navigator */}
      {viewMode === 'month' && (
        <div className="flex items-center justify-between bg-warm-50 dark:bg-slate-800 rounded-2xl px-4 py-3 mb-4 shadow-sm">
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-white text-xl disabled:opacity-30"
            aria-label="חודש הבא"
          >
            ←
          </button>
          <div className="text-center">
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {HEBREW_MONTHS[selectedMonth - 1]} {selectedYear}
            </span>
            {isCurrentMonth && (
              <span className="block text-xs text-blue-500 dark:text-blue-400 mt-0.5">החודש</span>
            )}
          </div>
          <button
            onClick={goToPrevMonth}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-white text-xl"
            aria-label="חודש קודם"
          >
            →
          </button>
        </div>
      )}

      {/* Week navigator */}
      {viewMode === 'week' && (
        <div className="flex items-center justify-between bg-warm-50 dark:bg-slate-800 rounded-2xl px-4 py-3 mb-4 shadow-sm">
          <button
            onClick={() => setSelectedWeekId((w) => getAdjacentWeekId(w, -1))}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-white text-xl"
            aria-label="שבוע קודם"
          >
            →
          </button>
          <div className="text-center">
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {weekIdLabel(selectedWeekId)}
            </span>
            {isCurrentWeek && (
              <span className="block text-xs text-blue-500 dark:text-blue-400 mt-0.5">השבוע</span>
            )}
          </div>
          <button
            onClick={() => setSelectedWeekId((w) => getAdjacentWeekId(w, 1))}
            disabled={isCurrentWeek}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-warm-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-white text-xl disabled:opacity-30"
            aria-label="שבוע הבא"
          >
            ←
          </button>
        </div>
      )}

      {/* Summary cards */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 text-center shadow-sm">
            <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">שעות סה״כ</div>
          </div>
          <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 text-center shadow-sm">
            <div className="text-3xl font-extrabold text-slate-700 dark:text-slate-200">
              {totalShifts}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">משמרות סה״כ</div>
          </div>
        </div>
      )}

      {/* Bar chart */}
      {stats.length > 0 && (
        <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl p-4 mb-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">שעות לפי עובד</h2>
          <div className="flex flex-col gap-3">
            {stats.map(({ employee, hours }) => {
              const pct = Math.round((hours / maxHours) * 100);
              const isManager = employee.role === 'manager';
              return (
                <div key={employee.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{isManager ? '⭐' : '👤'}</span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {employee.name}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                      {hours % 1 === 0 ? hours : hours.toFixed(1)}ש׳
                    </span>
                  </div>
                  <div className="h-3 bg-warm-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isManager ? 'bg-blue-500' : 'bg-indigo-400 dark:bg-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      {stats.length === 0 ? (
        <p className="text-center text-slate-400 dark:text-slate-500 py-16 text-sm">
          אין נתונים לתקופה זו
        </p>
      ) : (
        <div className="bg-warm-50 dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_56px_64px] gap-2 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-warm-200 dark:border-slate-700">
            <span>עובד</span>
            <span className="text-center">משמרות</span>
            <span className="text-center">שעות</span>
          </div>
          {stats.map(({ employee, shifts, hours }, idx) => (
            <div
              key={employee.id}
              className={`grid grid-cols-[1fr_56px_64px] gap-2 items-center px-4 py-3 ${
                idx < stats.length - 1 ? 'border-b border-warm-200 dark:border-slate-700' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{employee.role === 'manager' ? '⭐' : '👤'}</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
