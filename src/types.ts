export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type SoundType = 'none' | 'rain' | 'forest' | 'ocean' | 'cafe' | 'whitenoise' | 'brownnoise' | 'deepfocus';

export type NasaSoundId = 'mars-wind' | 'insight' | 'jupiter' | 'saturn' | 'voyager';
export type NasaPlayState = 'idle' | 'loading' | 'playing' | 'simulated' | 'error';

export interface NasaSoundDef {
  id: NasaSoundId;
  icon: string;
  label: string;
  desc: string;
  urls: string[];
}

export const NASA_SOUNDS: NasaSoundDef[] = [
  {
    id: 'mars-wind',
    icon: '🔴',
    label: '火星の風',
    desc: 'Perseverance · Mars · 2021',
    urls: [
      'https://www.nasa.gov/wp-content/uploads/2018/12/InSightMartianWindLow-Pitched.mp3',
      'https://www.nasa.gov/wp-content/uploads/2021/02/supercam-mars-wind.mp3',
    ],
  },
  {
    id: 'insight',
    icon: '📡',
    label: 'InSight 地震計',
    desc: 'InSight Lander · Mars · 2019',
    urls: [
      'https://www.nasa.gov/wp-content/uploads/2019/04/insight_seismometer_quake.mp3',
    ],
  },
  {
    id: 'saturn',
    icon: '🪐',
    label: '土星の電波',
    desc: 'Cassini · Saturn · 2004–2017',
    urls: [
      'https://www.nasa.gov/wp-content/uploads/2015/01/584791main_spookysaturn.mp3',
      'https://www.nasa.gov/wp-content/uploads/2015/01/584795main_saturn_radio_waves.mp3',
    ],
  },
  {
    id: 'jupiter',
    icon: '⚡',
    label: '木星電磁波',
    desc: 'Voyager · Jupiter · 1979',
    urls: [
      'https://www.nasa.gov/wp-content/uploads/2015/01/603921main_voyager_jupiter_lightning.mp3',
    ],
  },
  {
    id: 'voyager',
    icon: '🌌',
    label: '恒星間空間',
    desc: 'Voyager 1 · Interstellar · 2012',
    urls: [
      'https://www.nasa.gov/externalflash/interstellar.mp3',
      'https://www.nasa.gov/wp-content/uploads/2013/09/voyager_interstellar_plasma.mp3',
    ],
  },
];

export interface ReviewCard {
  id: number;
  label: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  consecutiveCorrect: number;
  route: 'default' | 'mastering' | 'mastered';
  intervalIdx: number;
  nextReview: number;
}

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
