import { useState, useCallback, useEffect } from 'react';
import { TimerRing } from './components/Timer';
import { TaskManager } from './components/TaskManager';
import { AmbientSounds } from './components/AmbientSounds';
import { Stats } from './components/Stats';
import { useTimer, useStats } from './hooks/useTimer';
import { useAudio } from './hooks/useAudio';
import { useNasaAudio } from './hooks/useNasaAudio';
import { TimerMode, Settings, DEFAULT_SETTINGS, SoundType, NasaSoundId } from './types';

type Tab = 'tasks' | 'sounds' | 'stats';

function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('focus_settings') || '{}') }; }
  catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: Settings) { localStorage.setItem('focus_settings', JSON.stringify(s)); }

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<Settings>(settings);
  const [tab, setTab] = useState<Tab>('tasks');
  const [notif, setNotif] = useState('');

  const timer = useTimer(settings);
  const { stats, refresh, recordTaskDone } = useStats();
  const audio = useAudio();
  const nasa = useNasaAudio();

  // request notification permission on first interaction
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // refresh stats when sessions complete
  useEffect(() => { refresh(); }, [timer.totalToday, refresh]);

  const showNotif = useCallback((msg: string) => {
    setNotif(msg);
    setTimeout(() => setNotif(''), 2500);
  }, []);

  const handleToggle = () => {
    timer.toggle();
    if (!timer.isRunning) showNotif('▶ 集中スタート');
  };

  const handleReset = () => {
    timer.reset();
    showNotif('リセットしました');
  };

  const handleModeSwitch = (m: TimerMode) => {
    timer.switchMode(m);
  };

  const handleTaskDone = useCallback(() => {
    recordTaskDone();
    showNotif('✓ タスク完了！');
  }, [recordTaskDone, showNotif]);

  const handleSoundPlay = useCallback((type: SoundType) => {
    audio.play(type);
  }, [audio]);

  const handleNasaPlay = useCallback((id: NasaSoundId) => {
    const labels: Record<NasaSoundId, string> = {
      'mars-wind': '火星の風',
      'insight': 'InSight 地震計',
      'saturn': '土星の電波',
      'jupiter': '木星電磁波',
      'voyager': '恒星間空間',
    };
    nasa.play(id);
    showNotif(`🚀 ${labels[id]} を読み込んでいます...`);
  }, [nasa, showNotif]);

  const handleNasaStop = useCallback(() => {
    nasa.stop();
  }, [nasa]);

  const openSettings = () => {
    setDraft({ ...settings });
    setShowSettings(true);
  };

  const saveSettingsHandler = () => {
    setSettings(draft);
    saveSettings(draft);
    setShowSettings(false);
    timer.switchMode('focus');
    showNotif('設定を保存しました');
  };

  const modeColor = timer.mode === 'focus' ? 'var(--accent)'
    : timer.mode === 'shortBreak' ? 'var(--green)' : 'var(--blue)';

  // dot indicators
  const totalDots = settings.longBreakEvery;
  const filledDots = timer.sessionStreak;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Focus Timer
        </div>
        <button className="btn-icon" onClick={openSettings} title="設定">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </header>

      <div className="app-body">
        {/* ─── Left: Timer ─── */}
        <div className="timer-panel">
          {/* Mode selector */}
          <div className="mode-selector">
            {(['focus','shortBreak','longBreak'] as TimerMode[]).map(m => (
              <button
                key={m}
                className={`mode-btn ${timer.mode === m ? `active-${m}` : ''}`}
                onClick={() => handleModeSwitch(m)}
              >
                {m === 'focus' ? 'フォーカス' : m === 'shortBreak' ? '短い休憩' : '長い休憩'}
              </button>
            ))}
          </div>

          {/* Ring */}
          <TimerRing mode={timer.mode} display={timer.display} progress={timer.progress} />

          {/* Controls */}
          <div className="timer-controls">
            <button className="btn-icon" onClick={handleReset} title="リセット">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
              </svg>
            </button>

            <button
              className={`btn-play mode-${timer.mode}`}
              onClick={handleToggle}
              title={timer.isRunning ? '一時停止' : '開始'}
            >
              {timer.isRunning ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{marginLeft:3}}>
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              )}
            </button>

            <button
              className="btn-icon"
              onClick={() => {
                const next: TimerMode = timer.mode === 'focus'
                  ? (timer.sessionStreak + 1 >= settings.longBreakEvery ? 'longBreak' : 'shortBreak')
                  : 'focus';
                handleModeSwitch(next);
              }}
              title="スキップ"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,4 15,12 5,20"/><line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </button>
          </div>

          {/* Session dots */}
          <div className="session-info">
            {Array.from({ length: totalDots }).map((_, i) => (
              <div
                key={i}
                className={`session-dot ${i < filledDots ? `done-${timer.mode}` : ''} ${timer.isRunning && i === filledDots ? 'current' : ''}`}
              />
            ))}
            <span className="session-text" style={{ color: modeColor }}>
              {filledDots}/{totalDots}セッション
            </span>
          </div>
        </div>

        {/* ─── Right: Side Panel ─── */}
        <div className="side-panel">
          <div className="panel-tabs">
            {([
              { key: 'tasks',  label: 'タスク',  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
              { key: 'sounds', label: 'サウンド', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg> },
              { key: 'stats',  label: '統計',    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
              <button
                key={t.key}
                className={`panel-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="panel-content">
            {tab === 'tasks' && <TaskManager onTaskDone={handleTaskDone} />}
            {tab === 'sounds' && (
              <AmbientSounds
                onAmbientPlay={handleSoundPlay}
                onNasaPlay={handleNasaPlay}
                onNasaStop={handleNasaStop}
                onVolume={(v) => { audio.setVolume(v); nasa.setVolume(v); }}
                nasaActiveId={nasa.activeId}
                nasaPlayState={nasa.playState}
              />
            )}
            {tab === 'stats' && <Stats stats={stats} totalToday={timer.totalToday} />}
          </div>
        </div>
      </div>

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <div className="settings-overlay" onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="settings-dialog">
            <div className="settings-header">
              <span className="settings-title">設定</span>
              <button className="settings-close" onClick={() => setShowSettings(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">タイマー（分）</div>
              {[
                { key: 'focusMins', label: 'フォーカス' },
                { key: 'shortBreakMins', label: '短い休憩' },
                { key: 'longBreakMins', label: '長い休憩' },
                { key: 'longBreakEvery', label: '長い休憩の間隔' },
              ].map(({ key, label }) => (
                <div key={key} className="settings-row">
                  <span className="settings-row-label">{label}</span>
                  <input
                    type="number"
                    className="settings-num-input"
                    value={draft[key as keyof Settings] as number}
                    min={1} max={60}
                    onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>

            <div className="settings-group">
              <div className="settings-group-label">自動スタート</div>
              {[
                { key: 'autoStartBreaks', label: '休憩を自動開始' },
                { key: 'autoStartFocus', label: 'フォーカスを自動開始' },
              ].map(({ key, label }) => (
                <div key={key} className="settings-row">
                  <span className="settings-row-label">{label}</span>
                  <button
                    className={`toggle ${draft[key as keyof Settings] ? 'on' : ''}`}
                    onClick={() => setDraft(d => ({ ...d, [key]: !d[key as keyof Settings] }))}
                  />
                </div>
              ))}
            </div>

            <button className="settings-save" onClick={saveSettingsHandler}>保存する</button>
          </div>
        </div>
      )}

      {notif && <div className="notif">{notif}</div>}
    </div>
  );
}
