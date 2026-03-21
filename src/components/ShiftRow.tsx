'use client';

import { motion } from 'framer-motion';
import type { Shift, Employee, Confirmation } from '@/lib/types';

interface ShiftRowProps {
  shift: Shift;
  employee: Employee | undefined;
  confirmation: Confirmation | undefined;
  isAdmin: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ShiftRow({
  shift,
  employee,
  confirmation,
  isAdmin,
  onEdit,
  onDelete,
}: ShiftRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center justify-between bg-warm-200 dark:bg-slate-700/50 rounded-xl p-3 gap-2"
    >
      {/* Shift info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-white truncate">
            {employee?.name ?? 'עובד לא ידוע'}
          </span>
          {confirmation && (
            <span className="text-green-500 dark:text-green-400 text-sm flex-shrink-0">{'\u2713'}</span>
          )}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <span>{shift.startTime}</span>
          <span className="mx-1">{'\u2013'}</span>
          <span>{shift.endTime}</span>
          {shift.role && (
            <span className="text-slate-500 dark:text-slate-400 mr-2">| {shift.role}</span>
          )}
        </div>
        {shift.note && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{shift.note}</p>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg active:bg-warm-300 dark:active:bg-slate-600"
            aria-label="ערוך משמרת"
          >
            <span className="text-lg">{'\u270F\uFE0F'}</span>
          </button>
          <button
            onClick={onDelete}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg active:bg-warm-300 dark:active:bg-slate-600"
            aria-label="מחק משמרת"
          >
            <span className="text-lg">{'\uD83D\uDDD1\uFE0F'}</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
