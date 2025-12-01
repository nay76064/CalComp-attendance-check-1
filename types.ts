
export interface AttendanceRecord {
  id: number;
  empNo: string;
  name: string;
  dateTime: string; // Format: DD/MM/YYYY HH:mm:ss
}

export interface UserSettings {
  empId: string;
  checkTimes: string[]; // Array of "HH:mm" strings
  checkDays: number[]; // Array of day indexes (0=Sun, 1=Mon, etc.)
  enableSound: boolean;
  customSound: string | null; // Base64 string of the audio file
  lastChecked: number;
  darkMode: boolean;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS',
  LOGS = 'LOGS'
}
