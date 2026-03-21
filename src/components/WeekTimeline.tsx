'use client';

import { useState, useEffect, useCallback } from 'react';
import DayCard from './DayCard';
import ShiftModal from './ShiftModal';
import { getShifts, getEmployees, getConfirmations, removeShift } from '@/lib/storage';
import { fetchHolidays, getHolidaysForDate, isErevChag } from '@/lib/hebcal';
import type { Shift, Employee, Confirmation, HolidayInfo } from '@/lib/types';

interface WeekTimelineProps {
  weekId: string;
  isAdmin: boolean;
}

function getWeekDates(weekId: string): string[] {
  // Parse "YYYY-Www" format
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return [];

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO 8601: Week 1 contains January 4th
  // Find Monday of week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday=0 to 7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Add (week - 1) * 7 days to get to the desired week's Monday
  monday.setDate(monday.getDate() + (week - 1) * 7);

  // In Israel, week starts on Sunday, so go back 1 day
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    // Use local date parts to avoid UTC offset shifting the date
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export default function WeekTimeline({ weekId, isAdmin }: WeekTimelineProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [holidays, setHolidays] = useState<Map<string, HolidayInfo[]>>(new Map());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const reload = useCallback(() => {
    setShifts(getShifts(weekId));
    setEmployees(getEmployees());
    setConfirmations(getConfirmations(weekId));
  }, [weekId]);

  useEffect(() => {
    reload();
    fetchHolidays().then(setHolidays);
  }, [reload]);

  const dates = getWeekDates(weekId);

  const handleEditShift = useCallback((shift: Shift) => {
    setEditingShift(shift);
    setDefaultDate(undefined);
    setModalOpen(true);
  }, []);

  const handleDeleteShift = useCallback(
    (shiftId: string) => {
      removeShift(shiftId);
      reload();
    },
    [reload]
  );

  const handleAddShift = useCallback((date: string) => {
    setEditingShift(null);
    setDefaultDate(date);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingShift(null);
    setDefaultDate(undefined);
  }, []);

  return (
    <>
      <div className="flex flex-col gap-3">
        {dates.map((date) => (
          <DayCard
            key={date}
            date={date}
            shifts={shifts.filter((s) => s.date === date)}
            employees={employees}
            confirmations={confirmations.filter((c) =>
              shifts.some((s) => s.date === date && s.id === c.shiftId)
            )}
            holidays={getHolidaysForDate(date, holidays)}
            isErevChag={isErevChag(date, holidays)}
            isAdmin={isAdmin}
            onEditShift={handleEditShift}
            onDeleteShift={handleDeleteShift}
            onAddShift={handleAddShift}
          />
        ))}
      </div>

      <ShiftModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSaved={reload}
        weekId={weekId}
        editShift={editingShift}
        defaultDate={defaultDate}
      />
    </>
  );
}
