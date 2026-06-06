import { DailyStat } from '../types';

function todayKey() { return new Date().toISOString().slice(0, 10); }

function dayLabel(dateStr: string): string {
  const days = ['日','月','火','水','木','金','土'];
  const d = new Date(dateStr + 'T00:00:00');
  return days[d.getDay()];
}

interface Props {
  stats: DailyStat[];
  totalToday: number;
}

export function Stats({ stats, totalToday }: Props) {
  const today = stats.find(s => s.date === todayKey());
  const todayMins = today?.minutes ?? 0;
  const todayTasks = today?.tasks ?? 0;

  const allSessions = stats.reduce((a, s) => a + s.sessions, 0);
  const allMins = stats.reduce((a, s) => a + s.minutes, 0);

  // last 7 days for chart
  const last7: DailyStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = stats.find(s => s.date === key);
    last7.push(found ?? { date: key, sessions: 0, minutes: 0, tasks: 0 });
  }

  const maxSessions = Math.max(...last7.map(s => s.sessions), 1);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalToday}</div>
          <div className="stat-label">今日のセッション</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayMins}<span>分</span></div>
          <div className="stat-label">今日の集中時間</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{todayTasks}</div>
          <div className="stat-label">今日の完了タスク</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{allSessions}</div>
          <div className="stat-label">累計セッション</div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-title">過去7日間のセッション数</div>
        <div className="chart-bars">
          {last7.map(s => {
            const isToday = s.date === todayKey();
            const height = `${Math.round((s.sessions / maxSessions) * 100)}%`;
            return (
              <div key={s.date} className="chart-col">
                <div className="chart-bar-wrap">
                  <div
                    className={`chart-bar ${isToday ? 'today' : ''}`}
                    style={{ height: s.sessions === 0 ? '4px' : height }}
                  />
                </div>
                <div className={`chart-day ${isToday ? 'today' : ''}`}>{dayLabel(s.date)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {allMins > 0 && (
        <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)' }}>
          累計集中時間: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{Math.round(allMins / 60)}時間{allMins % 60}分</span>
        </div>
      )}
    </div>
  );
}
