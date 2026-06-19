import { useState, useCallback } from 'react';
import { Task } from '../types';

function loadTasks(): Task[] {
  try { return JSON.parse(localStorage.getItem('focus_tasks') || '[]'); } catch { return []; }
}
function saveTasks(t: Task[]) { localStorage.setItem('focus_tasks', JSON.stringify(t)); }

interface Props { onTaskDone: () => void; }

export function TaskManager({ onTaskDone }: Props) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [input, setInput] = useState('');

  const update = useCallback((next: Task[]) => { setTasks(next); saveTasks(next); }, []);

  const add = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const next = [...tasks, { id: Date.now().toString(), text, done: false, createdAt: Date.now() }];
    update(next);
    setInput('');
  }, [input, tasks, update]);

  const toggle = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id);
    const wasDone = task?.done;
    const next = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    update(next);
    if (task && !wasDone) onTaskDone();
  }, [tasks, update, onTaskDone]);

  const remove = useCallback((id: string) => {
    update(tasks.filter(t => t.id !== id));
  }, [tasks, update]);

  const pending = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;

  return (
    <div>
      <div className="task-input-row">
        <input
          className="task-input"
          placeholder="タスクを追加..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <button className="btn-add" onClick={add}>追加</button>
      </div>

      {tasks.length > 0 && (
        <div className="task-stats-row">
          <span className="task-stat-badge">{pending} 件残り</span>
          {done > 0 && <span className="task-stat-badge">✓ {done} 件完了</span>}
        </div>
      )}

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="tasks-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{display:'block',margin:'0 auto 8px'}}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1" ry="1"/></svg>
            タスクを追加して集中セッションを管理しよう
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="task-item">
              <button
                className={`task-check ${task.done ? 'done' : ''}`}
                onClick={() => toggle(task.id)}
                aria-label="完了切り替え"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1.5,6 5,9.5 10.5,2.5"/>
                </svg>
              </button>
              <span className={`task-text ${task.done ? 'done' : ''}`}>{task.text}</span>
              <button className="task-delete" onClick={() => remove(task.id)} aria-label="削除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
