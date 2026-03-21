// ===== Core Data Models =====

export interface Employee {
  id: string;
  name: string;
}

export interface Shift {
  id: string;
  weekId: string;       // e.g. "2025-W22"
  date: string;         // ISO date "YYYY-MM-DD"
  employeeId: string;
  startTime: string;    // "HH:MM"
  endTime: string;      // "HH:MM"
  role?: string;
  note?: string;
}

export interface Confirmation {
  shiftId: string;
  employeeId: string;
  confirmedAt: string;  // ISO datetime
}

export interface WeekData {
  weekId: string;
  managerNote: string;
  shifts: Shift[];
  confirmations: Confirmation[];
}

// ===== Hebcal API Types =====

export interface HebcalItem {
  title: string;
  date: string;
  category: string;
  subcat?: string;
  hebrew?: string;
  yomtov?: boolean;
}

export interface HebcalResponse {
  items: HebcalItem[];
}

// ===== Weather API Types =====

export interface WeatherCurrent {
  temperature_2m: number;
  precipitation: number;
  weathercode: number;
}

export interface WeatherResponse {
  current: WeatherCurrent;
}

// ===== Holiday Info =====

export interface HolidayInfo {
  name: string;
  hebrew: string;
  isYomTov: boolean;
}
