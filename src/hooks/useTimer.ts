import { useState, useEffect, useRef, useCallback } from 'react';
import { TimerMode, Settings, DEFAULT_SETTINGS, DailyStat } from '../types';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStats(): DailyStat[] {
  try { return JSON.parse(localStorage.getItem('focus_stats') || '[]'); } catch { return []; }
}

function saveStats(stats: DailyStat[]) {
  localStorage.setItem('focus_stats', JSON.stringify(stats.slice(-30)));
}

export function useTimer(settings: Settings = DEFAULT_SETTINGS) {
  const duration = (mode: TimerMode) => {
    if (mode === 'focus') return settings.focusMins * 60;
    if (mode === 'shortBreak') return settings.shortBreakMins * 60;
    return settings.longBreakMins * 60;
  };

  const [mode, setMode] = useState<TimerMode>('focus');
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.focusMins * 60);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0); // sessions since last long break
  const [totalToday, setTotalToday] = useState(0); // completed focus sessions today

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // load today's count on mount
  useEffect(() => {
    const stats = loadStats();
    const today = stats.find(s => s.date === todayKey());
    if (today) setTotalToday(today.sessions);
  }, []);

  const recordSession = useCallback(() => {
    const stats = loadStats();
    const date = todayKey();
    const idx = stats.findIndex(s => s.date === date);
    if (idx >= 0) {
      stats[idx].sessions += 1;
      stats[idx].minutes += settingsRef.current.focusMins;
    } else {
      stats.push({ date, sessions: 1, minutes: settingsRef.current.focusMins, tasks: 0 });
    }
    saveStats(stats);
    setTotalToday(prev => prev + 1);
  }, []);

  const complete = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    const currentMode = modeRef.current;

    if (currentMode === 'focus') {
      recordSession();
      setSessionStreak(prev => {
        const next = prev + 1;
        const newMode = next >= settingsRef.current.longBreakEvery ? 'longBreak' : 'shortBreak';
        setMode(newMode);
        setTimeLeft(duration(newMode));
        setSessionsToday(p => p + 1);
        if (settingsRef.current.autoStartBreaks) setIsRunning(true);
        if (next >= settingsRef.current.longBreakEvery) return 0;
        return next;
      });
    } else {
      setMode('focus');
      setTimeLeft(duration('focus'));
      if (settingsRef.current.autoStartFocus) setIsRunning(true);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(currentMode === 'focus' ? 'Break time!' : 'Focus time!', {
        body: currentMode === 'focus' ? 'Great work! Take a break.' : 'Ready to focus again?',
        silent: false,
      });
    }
  }, [recordSession]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { complete(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, complete]);

  const toggle = useCallback(() => setIsRunning(r => !r), []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(duration(modeRef.current));
  }, []);

  const switchMode = useCallback((m: TimerMode) => {
    setIsRunning(false);
    setMode(m);
    setTimeLeft(duration(m));
    setSessionStreak(0);
  }, []);

  const totalDur = duration(mode);
  const progress = totalDur === 0 ? 0 : 1 - timeLeft / totalDur;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  return {
    mode, isRunning, timeLeft, progress,
    display: `${mm}:${ss}`,
    sessionsToday, totalToday, sessionStreak,
    toggle, reset, switchMode,
  };
}

export function useStats() {
  const [stats, setStats] = useState<DailyStat[]>(() => loadStats());

  const refresh = useCallback(() => setStats(loadStats()), []);

  const recordTaskDone = useCallback(() => {
    const date = todayKey();
    const all = loadStats();
    const idx = all.findIndex(s => s.date === date);
    if (idx >= 0) all[idx].tasks += 1;
    else all.push({ date, sessions: 0, minutes: 0, tasks: 1 });
    saveStats(all);
    setStats([...all]);
  }, []);

  return { stats, refresh, recordTaskDone };
}
