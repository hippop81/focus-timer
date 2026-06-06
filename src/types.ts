export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type SoundType = 'none' | 'rain' | 'forest' | 'ocean' | 'cafe' | 'whitenoise' | 'deepfocus';

export interface Task {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface DailyStat {
  date: string; // 'YYYY-MM-DD'
  sessions: number;
  minutes: number;
  tasks: number;
}

export interface Settings {
  focusMins: number;
  shortBreakMins: number;
  longBreakMins: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  focusMins: 25,
  shortBreakMins: 5,
  longBreakMins: 15,
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};
