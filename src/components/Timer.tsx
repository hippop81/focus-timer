import { TimerMode } from '../types';

const R = 120;
const CIRC = 2 * Math.PI * R;

const modeColors: Record<TimerMode, string> = {
  focus: '#9d7ff4',
  shortBreak: '#4ade80',
  longBreak: '#60a5fa',
};

const modeLabels: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

interface Props {
  mode: TimerMode;
  display: string;
  progress: number;
}

export function TimerRing({ mode, display, progress }: Props) {
  const color = modeColors[mode];
  const offset = CIRC * (1 - progress);

  return (
    <div className="timer-ring-wrap" style={{ '--ring-glow': `${color}55` } as React.CSSProperties}>
      <svg width="280" height="280" viewBox="0 0 280 280">
        <circle className="timer-track" cx="140" cy="140" r={R} strokeWidth="6" />
        <circle
          className="timer-progress"
          cx="140" cy="140" r={R}
          strokeWidth="6"
          stroke={color}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="timer-inner">
        <div className="timer-display">{display}</div>
        <div className="timer-label">{modeLabels[mode]}</div>
      </div>
    </div>
  );
}
