import { useState } from 'react';
import { SoundType } from '../types';

interface Sound {
  type: SoundType;
  icon: string;
  label: string;
}

const SOUNDS: Sound[] = [
  { type: 'none',       icon: '🔇', label: 'なし' },
  { type: 'rain',       icon: '🌧️',  label: '雨' },
  { type: 'forest',     icon: '🌿',  label: '森' },
  { type: 'ocean',      icon: '🌊',  label: '海' },
  { type: 'cafe',       icon: '☕',  label: 'カフェ' },
  { type: 'whitenoise', icon: '〰️',  label: 'ノイズ' },
  { type: 'deepfocus',  icon: '🎵',  label: 'ドローン' },
];

interface Props {
  onPlay: (type: SoundType) => void;
  onVolume: (v: number) => void;
}

export function AmbientSounds({ onPlay, onVolume }: Props) {
  const [active, setActive] = useState<SoundType>('none');
  const [volume, setVolume] = useState(50);

  const select = (type: SoundType) => {
    setActive(type);
    onPlay(type);
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    onVolume(v / 100);
  };

  return (
    <div>
      <div className="sound-grid">
        {SOUNDS.map(s => (
          <button
            key={s.type}
            className={`sound-btn ${active === s.type ? 'active' : ''}`}
            onClick={() => select(s.type)}
          >
            <span className="sound-icon">{s.icon}</span>
            <span className="sound-name">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="volume-row">
        <span className="volume-label">音量</span>
        <input
          type="range"
          className="volume-slider"
          min={0}
          max={100}
          value={volume}
          onChange={e => handleVolume(Number(e.target.value))}
          disabled={active === 'none'}
        />
        <span className="volume-value">{volume}%</span>
      </div>
    </div>
  );
}
