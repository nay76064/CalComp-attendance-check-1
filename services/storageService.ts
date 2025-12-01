
import { UserSettings, AttendanceRecord } from '../types';
import { DEFAULT_CHECK_TIMES, DEFAULT_CHECK_DAYS } from '../constants';

const SETTINGS_KEY = 'calcomp_settings';
const RECORDS_KEY = 'calcomp_records';

export const getSettings = (): UserSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Ensure new fields exist if loading from old localStorage
    return {
        ...parsed,
        checkDays: parsed.checkDays ?? DEFAULT_CHECK_DAYS,
        darkMode: parsed.darkMode ?? false
    };
  }
  return {
    empId: '',
    checkTimes: DEFAULT_CHECK_TIMES,
    checkDays: DEFAULT_CHECK_DAYS,
    enableSound: true,
    customSound: null,
    lastChecked: 0,
    darkMode: false
  };
};

export const saveSettings = (settings: UserSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getStoredRecords = (): AttendanceRecord[] => {
  const stored = localStorage.getItem(RECORDS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveRecords = (records: AttendanceRecord[]): void => {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};
