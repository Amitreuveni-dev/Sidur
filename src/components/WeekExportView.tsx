'use client';

import { forwardRef } from 'react';
import type { Shift, Employee } from '@/lib/types';

// ───────────────────────────── Constants ─────────────────────────────

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

// ───────────────────────────── Helpers ─────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ───────────────────────────── Props ─────────────────────────────

interface WeekExportViewProps {
  dates: string[];
  shifts: Shift[];
  employees: Employee[];
  weekLabel: string;
  candleLighting?: string;
  havdalah?: string;
}

/**
 * A static, print-friendly weekly grid used exclusively for image export.
 * Uses inline styles only — no Tailwind — for reliable html2canvas capture.
 */
const WeekExportView = forwardRef<HTMLDivElement, WeekExportViewProps>(
  ({ dates, shifts, employees, weekLabel, candleLighting, havdalah }, ref) => {
    const empNameMap = new Map<string, string>(employees.map((e) => [e.id, e.name]));

    // Build lookup: date → { morning: Shift[], evening: Shift[] }
    const shiftsByDate = new Map<string, { morning: Shift[]; evening: Shift[] }>();
    for (const date of dates) shiftsByDate.set(date, { morning: [], evening: [] });
    for (const s of shifts) {
      const bucket = shiftsByDate.get(s.date);
      if (!bucket) continue;
      if (s.startTime < '16:00') bucket.morning.push(s);
      else bucket.evening.push(s);
    }

    // ── Style tokens ──────────────────────────────────────────────
    const cell: React.CSSProperties = {
      border: '1px solid #e2d9ce',
      padding: '6px 8px',
      verticalAlign: 'top',
      minWidth: 72,
      fontFamily: 'Rubik, Arial, sans-serif',
    };

    const headerCell: React.CSSProperties = {
      ...cell,
      background: '#f5efe8',
      fontWeight: 700,
      fontSize: 11,
      textAlign: 'center',
      color: '#374151',
    };

    const sidebarCell: React.CSSProperties = {
      ...cell,
      width: 52,
      textAlign: 'center',
      fontWeight: 700,
      fontSize: 10,
    };

    const pill: React.CSSProperties = {
      display: 'inline-block',
      borderRadius: 20,
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 600,
      margin: '2px',
      whiteSpace: 'nowrap',
    };

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          background: '#fdfaf6',
          padding: 16,
          fontFamily: 'Rubik, Arial, sans-serif',
          width: 680,
          boxSizing: 'border-box',
        }}
      >
        {/* Title */}
        <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>
            סידור עבודה — {weekLabel}
          </h2>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>ניו דלהי · צור הדסה</span>
        </div>

        {/* Grid */}
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {/* Sidebar corner */}
              <th style={{ ...headerCell, ...sidebarCell }}>יום / עובד</th>
              {dates.map((date, i) => {
                const isFriday = i === 5;
                const isSat = i === 6;
                const bg = isFriday ? '#fef3c7' : isSat ? '#ede9fe' : '#f5efe8';
                const color = isFriday ? '#d97706' : isSat ? '#7c3aed' : '#374151';
                return (
                  <th key={date} style={{ ...headerCell, background: bg, color }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{HEBREW_DAYS[i]}</div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{formatShortDate(date)}</div>
                    {isFriday && candleLighting && (
                      <div style={{ fontSize: 9, color: '#d97706', marginTop: 2 }}>🕯 {candleLighting}</div>
                    )}
                    {isSat && havdalah && (
                      <div style={{ fontSize: 9, color: '#7c3aed', marginTop: 2 }}>✨ {havdalah}</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Morning row */}
            <tr>
              <td style={{ ...sidebarCell, ...cell, background: '#fffbeb', color: '#b45309' }}>
                ☀ בוקר
              </td>
              {dates.map((date, i) => {
                const isFriday = i === 5;
                const isSat = i === 6;
                const bucket = shiftsByDate.get(date);
                const morningShifts = isSat ? [] : (bucket?.morning ?? []);
                const bg = isFriday ? '#fffbeb' : isSat ? '#f5f3ff' : '#fffdf9';

                return (
                  <td key={`m-${date}`} style={{ ...cell, background: bg, minHeight: 48 }}>
                    {isFriday ? (
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#d97706', fontWeight: 700, padding: '6px 0' }}>
                        🕯 שבת שלום
                      </div>
                    ) : isSat ? (
                      <div style={{ textAlign: 'center', fontSize: 10, color: '#a78bfa', fontStyle: 'italic' }}>שבת</div>
                    ) : morningShifts.length > 0 ? (
                      morningShifts.map((s) => (
                        <span key={s.id} style={{ ...pill, background: '#fef3c7', color: '#92400e' }}>
                          {empNameMap.get(s.employeeId) ?? '?'}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 9, color: '#d1d5db' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Evening row */}
            <tr>
              <td style={{ ...sidebarCell, ...cell, background: '#eef2ff', color: '#4338ca' }}>
                🌙 ערב
              </td>
              {dates.map((date, i) => {
                const isFriday = i === 5;
                const isSat = i === 6;
                const bucket = shiftsByDate.get(date);
                const eveningShifts = isSat
                  ? [...(bucket?.morning ?? []), ...(bucket?.evening ?? [])].sort((a, b) =>
                      a.startTime.localeCompare(b.startTime),
                    )
                  : (bucket?.evening ?? []);
                const bg = isFriday ? '#fffbeb' : isSat ? '#f5f3ff' : '#f5f3ff40';

                return (
                  <td key={`e-${date}`} style={{ ...cell, background: bg, minHeight: 48 }}>
                    {isFriday ? (
                      <div style={{ textAlign: 'center', fontSize: 10, color: '#d97706', fontStyle: 'italic' }}>מנוחה</div>
                    ) : eveningShifts.length > 0 ? (
                      <>
                        {isSat && havdalah && (
                          <div style={{ fontSize: 9, color: '#7c3aed', marginBottom: 3, textAlign: 'center' }}>
                            ✨ מוצ&quot;ש {havdalah}
                          </div>
                        )}
                        {eveningShifts.map((s) => (
                          <span key={s.id} style={{ ...pill, background: '#e0e7ff', color: '#3730a3' }}>
                            {empNameMap.get(s.employeeId) ?? '?'}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span style={{ fontSize: 9, color: '#d1d5db' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 8, fontSize: 9, color: '#94a3b8', textAlign: 'left', direction: 'ltr' }}>
          נוצר באמצעות סידור PWA • {new Date().toLocaleDateString('he-IL')}
        </div>
      </div>
    );
  },
);

WeekExportView.displayName = 'WeekExportView';
export default WeekExportView;
