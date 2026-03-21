'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmployees, confirmShift } from '@/lib/storage';
import type { Employee, Shift } from '@/lib/types';

interface EmployeeConfirmProps {
  shift: Shift;
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  lockedEmployeeId?: string;
}

export default function EmployeeConfirm({
  shift,
  isOpen,
  onClose,
  onConfirmed,
  lockedEmployeeId,
}: EmployeeConfirmProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmployees(getEmployees());
      setSelectedId('');
    }
  }, [isOpen]);

  const resolvedId = lockedEmployeeId ?? selectedId;
  const lockedEmployee = lockedEmployeeId
    ? employees.find((e) => e.id === lockedEmployeeId)
    : null;

  const handleConfirm = useCallback(() => {
    if (!resolvedId) return;
    confirmShift(shift.id, resolvedId);
    onConfirmed();
    onClose();
  }, [resolvedId, shift.id, onConfirmed, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs bg-warm-50 dark:bg-slate-800 rounded-2xl p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-1">
              אישור משמרת
            </h2>

            {lockedEmployeeId ? (
              <p className="text-base text-slate-900 dark:text-white text-center font-bold mb-4">
                {lockedEmployee?.name ?? ''}
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">מי אתה?</p>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full bg-warm-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl p-3 min-h-[44px] outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                >
                  <option value="">בחר את שמך...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button
              onClick={handleConfirm}
              disabled={!resolvedId}
              className="w-full bg-green-500 text-white font-bold rounded-xl p-3 min-h-[44px] hover:bg-green-600 active:bg-green-700 active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-green-500 disabled:active:scale-100 transition-all duration-150"
            >
              אשר משמרת
            </button>

            <button
              onClick={onClose}
              className="w-full mt-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-sm p-2 min-h-[44px] transition-colors duration-150"
            >
              ביטול
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
