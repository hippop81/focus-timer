import { useState } from 'react';
import { SoundType, NasaSoundId, NasaPlayState, NASA_SOUNDS } from '../types';

interface Sound { type: SoundType; icon: string; label: string; }

const AMBIENT: Sound[] = [
  { type: 'none',       icon: '🔇', label: 'なし' },
  { type: 'rain',       icon: '🌧️',  label: '雨' },
  { type: 'forest',     icon: '🌿',  label: '森' },
  { type: 'ocean',      icon: '🌊',  label: '海' },
  { type: 'cafe',       icon: '☕',  label: 'カフェ' },
  { type: 'whitenoise', icon: '〰️',  label: 'ノイズ' },
  { type: 'deepfocus',  icon: '🎵',  label: 'ドローン' },
];

const STATE_LABEL: Record<NasaPlayState, string> = {
  idle: '',
  loading: '読込中',
  playing: 'NASA DATA',
  simulated: 'シミュ',
  error: 'エラー',
};

interface Props {
  onAmbientPlay: (type: SoundType) => void;
  onNasaPlay: (id: NasaSoundId) => void;
  onNasaStop: () => void;
  onVolume: (v: number) => void;
  nasaActiveId: NasaSoundId | null;
  nasaPlayState: NasaPlayState;
}

export function AmbientSounds({ onAmbientPlay, onNasaPlay, onNasaStop, onVolume, nasaActiveId, nasaPlayState }: Props) {
  const [activeAmbient, setActiveAmbient] = useState<SoundType>('none');
  const [volume, setVolume] = useState(50);

  const selectAmbient = (type: SoundType) => {
    setActiveAmbient(type);
    onNasaStop();
    onAmbientPlay(type);
  };

  const selectNasa = (id: NasaSoundId) => {
    if (nasaActiveId === id && nasaPlayState !== 'idle') {
      onNasaStop();
      return;
    }
    setActiveAmbient('none');
    onAmbientPlay('none');
    onNasaPlay(id);
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    onVolume(v / 100);
  };

  const isNasaActive = nasaActiveId !== null && nasaPlayState !== 'idle';

  return (
    <div>
      {/* ── Ambient ── */}
      <div className="sound-section-label">アンビエント</div>
      <div className="sound-grid" style={{ marginBottom: 20 }}>
        {AMBIENT.map(s => (
          <button
            key={s.type}
            className={`sound-btn ${activeAmbient === s.type && !isNasaActive ? 'active' : ''}`}
            onClick={() => selectAmbient(s.type)}
          >
            <span className="sound-icon">{s.icon}</span>
            <span className="sound-name">{s.label}</span>
          </button>
        ))}
      </div>

      {/* ── NASA Soundscape ── */}
      <div className="nasa-section-header">
        <div className="sound-section-label">🚀 NASA サウンドスケープ</div>
        <div className="nasa-badge">実データ</div>
      </div>
      <div className="sound-grid nasa-grid" style={{ marginBottom: 20 }}>
        {NASA_SOUNDS.map(s => {
          const isActive = nasaActiveId === s.id && nasaPlayState !== 'idle';
          const stateLabel = isActive ? STATE_LABEL[nasaPlayState] : '';
          const isLoading = isActive && nasaPlayState === 'loading';
          return (
            <button
              key={s.id}
              className={`sound-btn nasa-btn ${isActive ? 'active nasa-active' : ''} ${isLoading ? 'loading' : ''}`}
              onClick={() => selectNasa(s.id)}
              disabled={isLoading}
            >
              <span className="sound-icon">{s.icon}</span>
              <span className="sound-name">{s.label}</span>
              <span className="sound-desc">{s.desc}</span>
              {stateLabel && (
                <span className={`nasa-state-tag ${nasaPlayState === 'playing' ? 'tag-real' : nasaPlayState === 'simulated' ? 'tag-sim' : 'tag-loading'}`}>
                  {stateLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Volume ── */}
      <div className="volume-row">
        <span className="volume-label">音量</span>
        <input
          type="range"
          className="volume-slider"
          min={0} max={100}
          value={volume}
          onChange={e => handleVolume(Number(e.target.value))}
          disabled={activeAmbient === 'none' && !isNasaActive}
        />
        <span className="volume-value">{volume}%</span>
      </div>
    </div>
  );
}
