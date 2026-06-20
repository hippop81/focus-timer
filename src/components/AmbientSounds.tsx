import { NasaPlayState, NASA_SOUNDS } from '../types';
import { AmbientId, SoundChannelId, ChannelInfo, PRESETS } from '../hooks/useSoundMixer';

interface AmbientDef { id: AmbientId; icon: string; label: string; }

const AMBIENT: AmbientDef[] = [
  { id: 'rain',       icon: '🌧️',  label: '雨' },
  { id: 'forest',     icon: '🌿',  label: '森' },
  { id: 'ocean',      icon: '🌊',  label: '海' },
  { id: 'river',      icon: '🏞️',  label: '川' },
  { id: 'cafe',       icon: '☕',  label: 'カフェ' },
  { id: 'airport',    icon: '🛫',  label: '空港' },
  { id: 'airplane',   icon: '✈️',  label: '機内' },
  { id: 'localtrain', icon: '🚃',  label: '電車' },
  { id: 'ferrydeck',  icon: '⛴️',  label: 'フェリー' },
  { id: 'whitenoise', icon: '〰️',  label: 'ホワイト' },
  { id: 'brownnoise', icon: '🟤',  label: 'ブラウン' },
  { id: 'pinknoise',  icon: '🩷',  label: 'ピンク' },
  { id: 'deepfocus',  icon: '🎵',  label: 'ドローン' },
];

const STATE_LABEL: Record<NasaPlayState, string> = {
  idle: '', loading: '読込中', playing: 'NASA', simulated: 'シミュ', error: 'エラー',
};

interface Props {
  channels: Record<string, ChannelInfo>;
  activePreset: string | null;
  masterVolume: number;
  hasActive: boolean;
  onToggle: (id: SoundChannelId) => void;
  onChannelVolume: (id: SoundChannelId, v: number) => void;
  onMasterVolume: (v: number) => void;
  onPreset: (id: string) => void;
  onClearAll: () => void;
}

function ChannelRow({ icon, label, info, desc, nasaState, onToggle, onVolume }: {
  icon: string;
  label: string;
  info?: ChannelInfo;
  desc?: string;
  nasaState?: NasaPlayState;
  onToggle: () => void;
  onVolume: (v: number) => void;
}) {
  const active = info?.active ?? false;
  const vol = info?.volume ?? 0.5;
  const isLoading = nasaState === 'loading';
  const stateLabel = nasaState && nasaState !== 'idle' ? STATE_LABEL[nasaState] : '';

  return (
    <div className={`mix-channel ${active ? 'active' : ''}`}>
      <button
        className={`mix-toggle ${active ? 'on' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={onToggle}
        disabled={isLoading}
        title={label}
      >
        <span className="mix-icon">{icon}</span>
        <span className="mix-label">{label}</span>
        {desc && <span className="mix-desc">{desc}</span>}
        {stateLabel && (
          <span className={`mix-state ${
            nasaState === 'playing' ? 'state-real' :
            nasaState === 'simulated' ? 'state-sim' :
            nasaState === 'loading' ? 'state-load' : ''
          }`}>{stateLabel}</span>
        )}
      </button>
      <div className="mix-vol-wrap">
        <input
          type="range"
          className="mix-vol-slider"
          min={0} max={100}
          value={Math.round(vol * 100)}
          onChange={e => onVolume(Number(e.target.value) / 100)}
          disabled={!active}
        />
        <span className="mix-vol-val">{active ? Math.round(vol * 100) : '–'}</span>
      </div>
    </div>
  );
}

export function AmbientSounds({
  channels, activePreset, masterVolume, hasActive,
  onToggle, onChannelVolume, onMasterVolume, onPreset, onClearAll,
}: Props) {
  return (
    <div className="mixer">
      {/* ── Presets ── */}
      <div className="sound-section-label">プリセット</div>
      <div className="preset-grid">
        {PRESETS.map(p => (
          <button
            key={p.id}
            className={`preset-btn ${activePreset === p.id ? 'active' : ''}`}
            onClick={() => activePreset === p.id ? onClearAll() : onPreset(p.id)}
          >
            <span className="preset-icon">{p.icon}</span>
            <span className="preset-name">{p.label}</span>
          </button>
        ))}
      </div>

      {/* ── Ambient ── */}
      <div className="sound-section-label" style={{ marginTop: 20 }}>アンビエント</div>
      <div className="mix-channel-list">
        {AMBIENT.map(s => (
          <ChannelRow
            key={s.id}
            icon={s.icon}
            label={s.label}
            info={channels[s.id]}
            onToggle={() => onToggle(s.id)}
            onVolume={v => onChannelVolume(s.id, v)}
          />
        ))}
      </div>

      {/* ── NASA ── */}
      <div className="nasa-section-header" style={{ marginTop: 20 }}>
        <div className="sound-section-label" style={{ marginBottom: 0 }}>🚀 NASA サウンドスケープ</div>
        <div className="nasa-badge">実データ</div>
      </div>
      <div className="mix-channel-list" style={{ marginTop: 10 }}>
        {NASA_SOUNDS.map(s => (
          <ChannelRow
            key={s.id}
            icon={s.icon}
            label={s.label}
            desc={s.desc}
            info={channels[s.id]}
            nasaState={channels[s.id]?.nasaState}
            onToggle={() => onToggle(s.id)}
            onVolume={v => onChannelVolume(s.id, v)}
          />
        ))}
      </div>

      {/* ── Master Volume ── */}
      <div className="volume-row" style={{ marginTop: 20 }}>
        <span className="volume-label">マスター</span>
        <input
          type="range"
          className="volume-slider"
          min={0} max={100}
          value={masterVolume}
          onChange={e => onMasterVolume(Number(e.target.value))}
          disabled={!hasActive}
        />
        <span className="volume-value">{masterVolume}%</span>
      </div>

      {hasActive && (
        <button className="mix-clear-btn" onClick={onClearAll}>
          すべて停止
        </button>
      )}
    </div>
  );
}
