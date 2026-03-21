'use client';

import type { Employee, Shift, Confirmation, WeekData } from './types';

// ===== Storage Keys =====
const KEYS = {
  EMPLOYEES: 'sidur_employees',
  SHIFTS: 'sidur_shifts',
  CONFIRMATIONS: 'sidur_confirmations',
  MANAGER_NOTES: 'sidur_manager_notes',
  ADMIN_CODE: 'sidur_admin_code',
  ADMIN_SESSION: 'sidur_admin_session',
} as const;

// ===== Generic Helpers =====

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ===== Employees =====

export function getEmployees(): Employee[] {
  return getItem<Employee[]>(KEYS.EMPLOYEES, []);
}

export function saveEmployees(employees: Employee[]): void {
  setItem(KEYS.EMPLOYEES, employees);
}

export function addEmployee(name: string): Employee {
  const employees = getEmployees();
  const newEmployee: Employee = {
    id: crypto.randomUUID(),
    name,
  };
  employees.push(newEmployee);
  saveEmployees(employees);
  return newEmployee;
}

export function removeEmployee(id: string): void {
  const employees = getEmployees().filter((e) => e.id !== id);
  saveEmployees(employees);
}

// ===== Shifts =====

export function getShifts(weekId?: string): Shift[] {
  const all = getItem<Shift[]>(KEYS.SHIFTS, []);
  if (weekId) return all.filter((s) => s.weekId === weekId);
  return all;
}

export function saveShift(shift: Shift): void {
  const all = getItem<Shift[]>(KEYS.SHIFTS, []);
  const idx = all.findIndex((s) => s.id === shift.id);
  if (idx >= 0) {
    all[idx] = shift;
  } else {
    all.push(shift);
  }
  setItem(KEYS.SHIFTS, all);
}

export function removeShift(id: string): void {
  const all = getItem<Shift[]>(KEYS.SHIFTS, []).filter((s) => s.id !== id);
  setItem(KEYS.SHIFTS, all);
  // Also remove confirmations for this shift
  const confs = getItem<Confirmation[]>(KEYS.CONFIRMATIONS, []).filter(
    (c) => c.shiftId !== id
  );
  setItem(KEYS.CONFIRMATIONS, confs);
}

// ===== Confirmations =====

export function getConfirmations(weekId?: string): Confirmation[] {
  const all = getItem<Confirmation[]>(KEYS.CONFIRMATIONS, []);
  if (!weekId) return all;
  const weekShiftIds = new Set(getShifts(weekId).map((s) => s.id));
  return all.filter((c) => weekShiftIds.has(c.shiftId));
}

export function confirmShift(shiftId: string, employeeId: string): Confirmation {
  const confs = getItem<Confirmation[]>(KEYS.CONFIRMATIONS, []);
  // Prevent duplicates
  const existing = confs.find(
    (c) => c.shiftId === shiftId && c.employeeId === employeeId
  );
  if (existing) return existing;

  const confirmation: Confirmation = {
    shiftId,
    employeeId,
    confirmedAt: new Date().toISOString(),
  };
  confs.push(confirmation);
  setItem(KEYS.CONFIRMATIONS, confs);
  return confirmation;
}

export function cancelConfirmation(shiftId: string, employeeId: string): void {
  const confs = getItem<Confirmation[]>(KEYS.CONFIRMATIONS, []).filter(
    (c) => !(c.shiftId === shiftId && c.employeeId === employeeId)
  );
  setItem(KEYS.CONFIRMATIONS, confs);
}

// ===== Manager Notes =====

export function getManagerNote(weekId: string): string {
  const notes = getItem<Record<string, string>>(KEYS.MANAGER_NOTES, {});
  return notes[weekId] ?? '';
}

export function saveManagerNote(weekId: string, note: string): void {
  const notes = getItem<Record<string, string>>(KEYS.MANAGER_NOTES, {});
  notes[weekId] = note;
  setItem(KEYS.MANAGER_NOTES, notes);
}

// ===== Week Data (composite) =====

export function getWeekData(weekId: string): WeekData {
  return {
    weekId,
    managerNote: getManagerNote(weekId),
    shifts: getShifts(weekId),
    confirmations: getConfirmations(weekId),
  };
}

// ===== Admin Auth =====

export function getAdminCode(): string {
  return getItem<string>(KEYS.ADMIN_CODE, '1234');
}

export function setAdminCode(code: string): void {
  setItem(KEYS.ADMIN_CODE, code);
}

export function isAdminAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(KEYS.ADMIN_SESSION) === 'true';
}

export function authenticateAdmin(code: string): boolean {
  const stored = getAdminCode();
  if (code === stored) {
    sessionStorage.setItem(KEYS.ADMIN_SESSION, 'true');
    return true;
  }
  return false;
}

export function logoutAdmin(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEYS.ADMIN_SESSION);
}
