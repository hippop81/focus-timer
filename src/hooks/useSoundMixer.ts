import { useRef, useState, useCallback } from 'react';
import { NasaSoundId, NasaPlayState, NASA_SOUNDS } from '../types';

// ═══ Channel types ═══════════════════════════════════════════════

export type AmbientId = 'rain' | 'forest' | 'ocean' | 'cafe' | 'whitenoise' | 'brownnoise' | 'pinknoise' | 'deepfocus' | 'airport' | 'airplane' | 'localtrain' | 'ferrydeck' | 'river';
export type SoundChannelId = AmbientId | NasaSoundId;

const NASA_IDS: readonly string[] = ['mars-wind', 'insight', 'saturn', 'jupiter', 'voyager'];
function isNasa(id: string): id is NasaSoundId { return NASA_IDS.includes(id); }

export interface ChannelInfo {
  active: boolean;
  volume: number;
  nasaState?: NasaPlayState;
}

export interface PresetDef {
  id: string;
  icon: string;
  label: string;
  channels: { id: SoundChannelId; volume: number }[];
}

export const PRESETS: PresetDef[] = [
  {
    id: 'deep-space', icon: '🌌', label: 'Deep Space',
    channels: [
      { id: 'voyager', volume: 0.6 },
      { id: 'deepfocus', volume: 0.3 },
      { id: 'whitenoise', volume: 0.1 },
    ],
  },
  {
    id: 'cafe-study', icon: '☕', label: 'Cafe Study',
    channels: [
      { id: 'cafe', volume: 0.6 },
      { id: 'brownnoise', volume: 0.25 },
    ],
  },
  {
    id: 'rainy-library', icon: '📚', label: 'Rainy Library',
    channels: [
      { id: 'rain', volume: 0.5 },
      { id: 'brownnoise', volume: 0.2 },
      { id: 'forest', volume: 0.1 },
    ],
  },
  {
    id: 'night-train', icon: '🚂', label: 'Night Train',
    channels: [
      { id: 'localtrain', volume: 0.5 },
      { id: 'brownnoise', volume: 0.25 },
      { id: 'rain', volume: 0.1 },
    ],
  },
  {
    id: 'airport-focus', icon: '✈️', label: 'Airport Focus',
    channels: [
      { id: 'airport', volume: 0.5 },
      { id: 'pinknoise', volume: 0.15 },
      { id: 'cafe', volume: 0.1 },
    ],
  },
  {
    id: 'ferry-study', icon: '⛴️', label: 'Ferry Study',
    channels: [
      { id: 'ferrydeck', volume: 0.5 },
      { id: 'ocean', volume: 0.15 },
      { id: 'brownnoise', volume: 0.1 },
    ],
  },
  {
    id: 'late-study', icon: '🌙', label: 'Late Study',
    channels: [
      { id: 'brownnoise', volume: 0.4 },
      { id: 'deepfocus', volume: 0.2 },
      { id: 'river', volume: 0.15 },
    ],
  },
];

// ═══ Audio primitives ════════════════════════════════════════════

type Stoppable = AudioBufferSourceNode | OscillatorNode;

function makeNoise(ctx: AudioContext, type: 'white' | 'brown' | 'pink', secs = 4): AudioBuffer {
  const len = ctx.sampleRate * secs;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  } else {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

function loopSrc(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; return src;
}

function lpf(ctx: AudioContext, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; return f;
}
function bpf(ctx: AudioContext, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; return f;
}
function hpf(ctx: AudioContext, freq: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; return f;
}
function filt(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
}
function gn(ctx: AudioContext, v: number): GainNode {
  const g = ctx.createGain(); g.gain.value = v; return g;
}
function lfo(ctx: AudioContext, hz: number, amp: number, target: AudioParam) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
  const g = ctx.createGain(); g.gain.value = amp;
  o.connect(g); g.connect(target); o.start(); return { o, g };
}

interface SynthResult { stoppable: Stoppable[]; misc: AudioNode[]; }

// ═══ Ambient synthesis setups ════════════════════════════════════

function setupRain(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const brown = makeNoise(ctx, 'brown'); const white = makeNoise(ctx, 'white');
  const mk = (buf: AudioBuffer, f: BiquadFilterNode, vol: number) => {
    const src = loopSrc(ctx, buf); const g = gn(ctx, vol);
    src.connect(f); f.connect(g); g.connect(out); src.start();
    stoppable.push(src); misc.push(f, g);
  };
  mk(brown, lpf(ctx, 1000, 0.4), 0.38);
  mk(brown, lpf(ctx, 180, 0.5), 0.18);
  mk(white, bpf(ctx, 2800, 1.8), 0.04);
  return { stoppable, misc };
}

function setupForest(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const pink = makeNoise(ctx, 'pink');
  const src1 = loopSrc(ctx, pink); const f1 = lpf(ctx, 700, 0.5); const g1 = gn(ctx, 0.12);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1);
  const src2 = loopSrc(ctx, pink); const f2 = bpf(ctx, 380, 0.6); const g2 = gn(ctx, 0.09);
  const { o: l1, g: lg1 } = lfo(ctx, 0.15, 0.06, g2.gain);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2, l1, lg1);
  return { stoppable, misc };
}

function setupOcean(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const brown = makeNoise(ctx, 'brown', 6); const white = makeNoise(ctx, 'white');
  const src1 = loopSrc(ctx, brown); const f1 = lpf(ctx, 550, 0.4); const g1 = gn(ctx, 0.22);
  const { o: l1, g: lg1 } = lfo(ctx, 0.11, 0.14, g1.gain);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1, l1, lg1);
  const src2 = loopSrc(ctx, brown); const f2 = lpf(ctx, 90); const g2 = gn(ctx, 0.18);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2);
  const src3 = loopSrc(ctx, white); const f3 = hpf(ctx, 3200); const g3 = gn(ctx, 0.015);
  src3.connect(f3); f3.connect(g3); g3.connect(out); src3.start();
  stoppable.push(src3); misc.push(f3, g3);
  return { stoppable, misc };
}

function setupCafe(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const pink = makeNoise(ctx, 'pink');
  const src1 = loopSrc(ctx, pink); const f1 = bpf(ctx, 900, 0.6); const g1 = gn(ctx, 0.1);
  const { o: l1, g: lg1 } = lfo(ctx, 0.28, 0.045, g1.gain);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1, l1, lg1);
  const src2 = loopSrc(ctx, pink); const f2 = lpf(ctx, 280, 0.5); const g2 = gn(ctx, 0.08);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2);
  const src3 = loopSrc(ctx, makeNoise(ctx, 'white')); const f3 = bpf(ctx, 4200, 3); const g3 = gn(ctx, 0.004);
  src3.connect(f3); f3.connect(g3); g3.connect(out); src3.start();
  stoppable.push(src3); misc.push(f3, g3);
  return { stoppable, misc };
}

function setupWhiteNoise(ctx: AudioContext, out: GainNode): SynthResult {
  const buf = makeNoise(ctx, 'white');
  const src = loopSrc(ctx, buf); const f = lpf(ctx, 12000); const g = gn(ctx, 0.18);
  src.connect(f); f.connect(g); g.connect(out); src.start();
  return { stoppable: [src], misc: [f, g] };
}

function setupBrownNoise(ctx: AudioContext, out: GainNode): SynthResult {
  const buf = makeNoise(ctx, 'brown', 6);
  const src = loopSrc(ctx, buf); const f = lpf(ctx, 800, 0.5); const g = gn(ctx, 0.3);
  src.connect(f); f.connect(g); g.connect(out); src.start();
  return { stoppable: [src], misc: [f, g] };
}

function setupDeepFocus(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const buildOsc = (freq: number, vol: number) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = gn(ctx, vol);
    const { o: l, g: lg } = lfo(ctx, 0.07, vol * 0.4, g.gain);
    o.connect(g); g.connect(out); o.start();
    stoppable.push(o); misc.push(g, l, lg);
  };
  buildOsc(40, 0.14); buildOsc(80, 0.06); buildOsc(120, 0.025);
  const pink = makeNoise(ctx, 'pink');
  const src = loopSrc(ctx, pink); const f = lpf(ctx, 220, 0.5); const g = gn(ctx, 0.04);
  src.connect(f); f.connect(g); g.connect(out); src.start();
  stoppable.push(src); misc.push(f, g);
  return { stoppable, misc };
}

function setupPinkNoise(ctx: AudioContext, out: GainNode): SynthResult {
  const buf = makeNoise(ctx, 'pink');
  const src = loopSrc(ctx, buf); const f = lpf(ctx, 14000); const g = gn(ctx, 0.2);
  src.connect(f); f.connect(g); g.connect(out); src.start();
  return { stoppable: [src], misc: [f, g] };
}

function setupAirport(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // HVAC / terminal rumble
  const brown = makeNoise(ctx, 'brown');
  const src1 = loopSrc(ctx, brown); const f1 = lpf(ctx, 300, 0.4); const g1 = gn(ctx, 0.2);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1);
  // Crowd murmur: band-passed pink noise with slow modulation
  const pink = makeNoise(ctx, 'pink');
  const src2 = loopSrc(ctx, pink); const f2 = bpf(ctx, 700, 0.5); const g2 = gn(ctx, 0.1);
  const { o: l1, g: lg1 } = lfo(ctx, 0.12, 0.05, g2.gain);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2, l1, lg1);
  // PA announcement ambience: filtered mid-high with slow swell
  const src3 = loopSrc(ctx, pink); const f3 = bpf(ctx, 2200, 1.5); const g3 = gn(ctx, 0.015);
  const { o: l2, g: lg2 } = lfo(ctx, 0.04, 0.012, g3.gain);
  src3.connect(f3); f3.connect(g3); g3.connect(out); src3.start();
  stoppable.push(src3); misc.push(f3, g3, l2, lg2);
  // High-frequency air / echo
  const white = makeNoise(ctx, 'white');
  const src4 = loopSrc(ctx, white); const f4 = bpf(ctx, 5000, 2); const g4 = gn(ctx, 0.008);
  src4.connect(f4); f4.connect(g4); g4.connect(out); src4.start();
  stoppable.push(src4); misc.push(f4, g4);
  return { stoppable, misc };
}

function setupAirplane(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Engine drone: heavy brown noise low-pass
  const brown = makeNoise(ctx, 'brown', 6);
  const src1 = loopSrc(ctx, brown); const f1 = lpf(ctx, 200, 0.5); const g1 = gn(ctx, 0.3);
  const { o: l1, g: lg1 } = lfo(ctx, 0.03, 0.04, g1.gain);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1, l1, lg1);
  // Cabin air circulation: mid-range band-pass
  const white = makeNoise(ctx, 'white');
  const src2 = loopSrc(ctx, white); const f2 = bpf(ctx, 1400, 0.8); const g2 = gn(ctx, 0.06);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2);
  // Engine vibration: very low sine
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 45;
  const g3 = gn(ctx, 0.08);
  const { o: l2, g: lg2 } = lfo(ctx, 0.02, 3, o1.frequency);
  o1.connect(g3); g3.connect(out); o1.start();
  stoppable.push(o1); misc.push(g3, l2, lg2);
  // Subtle high hiss
  const src3 = loopSrc(ctx, white); const f3 = hpf(ctx, 6000); const g4 = gn(ctx, 0.01);
  src3.connect(f3); f3.connect(g4); g4.connect(out); src3.start();
  stoppable.push(src3); misc.push(f3, g4);
  return { stoppable, misc };
}

function setupLocalTrain(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Rail clatter: rhythmic amplitude modulation on band-passed noise
  const brown = makeNoise(ctx, 'brown');
  const src1 = loopSrc(ctx, brown); const f1 = bpf(ctx, 600, 0.6); const g1 = gn(ctx, 0.14);
  // ~3.2 Hz modulation for rail joint rhythm (approx every 0.3s)
  const { o: l1, g: lg1 } = lfo(ctx, 3.2, 0.1, g1.gain);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1, l1, lg1);
  // Engine/motor hum
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
  const g2 = gn(ctx, 0.1);
  const { o: l2, g: lg2 } = lfo(ctx, 0.05, 4, o1.frequency);
  o1.connect(g2); g2.connect(out); o1.start();
  stoppable.push(o1); misc.push(g2, l2, lg2);
  // Wheel-on-rail high-frequency
  const white = makeNoise(ctx, 'white');
  const src2 = loopSrc(ctx, white); const f2 = bpf(ctx, 3500, 1.5); const g3 = gn(ctx, 0.02);
  const { o: l3, g: lg3 } = lfo(ctx, 3.2, 0.015, g3.gain);
  src2.connect(f2); f2.connect(g3); g3.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g3, l3, lg3);
  // Low rumble
  const src3 = loopSrc(ctx, brown); const f3 = lpf(ctx, 120); const g4 = gn(ctx, 0.12);
  src3.connect(f3); f3.connect(g4); g4.connect(out); src3.start();
  stoppable.push(src3); misc.push(f3, g4);
  return { stoppable, misc };
}

function setupFerryDeck(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Waves against hull: slow-modulated brown noise
  const brown = makeNoise(ctx, 'brown', 6);
  const src1 = loopSrc(ctx, brown); const f1 = lpf(ctx, 400, 0.4); const g1 = gn(ctx, 0.18);
  const { o: l1, g: lg1 } = lfo(ctx, 0.09, 0.12, g1.gain);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1, l1, lg1);
  // Deck wind: high-pass filtered noise with modulation
  const white = makeNoise(ctx, 'white');
  const src2 = loopSrc(ctx, white); const f2 = hpf(ctx, 800); const f2b = lpf(ctx, 4000);
  const g2 = gn(ctx, 0.06);
  const { o: l2, g: lg2 } = lfo(ctx, 0.07, 0.04, g2.gain);
  src2.connect(f2); f2.connect(f2b); f2b.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, f2b, g2, l2, lg2);
  // Engine throb: low oscillators
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 38;
  const g3 = gn(ctx, 0.1);
  const { o: l3, g: lg3 } = lfo(ctx, 0.04, 2, o1.frequency);
  o1.connect(g3); g3.connect(out); o1.start();
  stoppable.push(o1); misc.push(g3, l3, lg3);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 76;
  const g4 = gn(ctx, 0.04);
  o2.connect(g4); g4.connect(out); o2.start();
  stoppable.push(o2); misc.push(g4);
  // Spray / splash: very subtle high band-pass
  const src3 = loopSrc(ctx, white); const f3 = bpf(ctx, 6000, 2); const g5 = gn(ctx, 0.008);
  const { o: l4, g: lg4 } = lfo(ctx, 0.15, 0.006, g5.gain);
  src3.connect(f3); f3.connect(g5); g5.connect(out); src3.start();
  stoppable.push(src3); misc.push(f3, g5, l4, lg4);
  return { stoppable, misc };
}

function setupRiver(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Water body: brown noise base
  const brown = makeNoise(ctx, 'brown');
  const src1 = loopSrc(ctx, brown); const f1 = lpf(ctx, 600, 0.4); const g1 = gn(ctx, 0.15);
  const { o: l1, g: lg1 } = lfo(ctx, 0.06, 0.06, g1.gain);
  src1.connect(f1); f1.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, g1, l1, lg1);
  // Babbling: multiple band-passed white noise layers
  const white = makeNoise(ctx, 'white');
  const bands = [1200, 2400, 4800];
  bands.forEach((freq, i) => {
    const src = loopSrc(ctx, white); const f = bpf(ctx, freq, 1.2); const g = gn(ctx, 0.025 - i * 0.005);
    const { o: l, g: lg } = lfo(ctx, 0.2 + i * 0.15, 0.015, g.gain);
    src.connect(f); f.connect(g); g.connect(out); src.start();
    stoppable.push(src); misc.push(f, g, l, lg);
  });
  // Gentle mid-flow
  const pink = makeNoise(ctx, 'pink');
  const src2 = loopSrc(ctx, pink); const f2 = bpf(ctx, 800, 0.6); const g2 = gn(ctx, 0.06);
  const { o: l2, g: lg2 } = lfo(ctx, 0.1, 0.03, g2.gain);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2, l2, lg2);
  return { stoppable, misc };
}

function startAmbientSynth(id: AmbientId, ctx: AudioContext, out: GainNode): SynthResult {
  switch (id) {
    case 'rain': return setupRain(ctx, out);
    case 'forest': return setupForest(ctx, out);
    case 'ocean': return setupOcean(ctx, out);
    case 'cafe': return setupCafe(ctx, out);
    case 'whitenoise': return setupWhiteNoise(ctx, out);
    case 'brownnoise': return setupBrownNoise(ctx, out);
    case 'pinknoise': return setupPinkNoise(ctx, out);
    case 'deepfocus': return setupDeepFocus(ctx, out);
    case 'airport': return setupAirport(ctx, out);
    case 'airplane': return setupAirplane(ctx, out);
    case 'localtrain': return setupLocalTrain(ctx, out);
    case 'ferrydeck': return setupFerryDeck(ctx, out);
    case 'river': return setupRiver(ctx, out);
  }
}

// ═══ NASA synthesis fallbacks ════════════════════════════════════

function synthMarsWind(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const brown = makeNoise(ctx, 'brown'); const white = makeNoise(ctx, 'white');
  const src1 = ctx.createBufferSource(); src1.buffer = brown; src1.loop = true;
  const f1 = filt(ctx, 'highpass', 600, 0.4); const f1b = filt(ctx, 'lowpass', 3000, 0.5);
  const g1 = gn(ctx, 0.22);
  const { o: l1, g: lg1 } = lfo(ctx, 0.08, 0.1, g1.gain);
  src1.connect(f1); f1.connect(f1b); f1b.connect(g1); g1.connect(out); src1.start();
  stoppable.push(src1); misc.push(f1, f1b, g1, l1, lg1);
  const src2 = ctx.createBufferSource(); src2.buffer = white; src2.loop = true;
  const f2 = filt(ctx, 'bandpass', 5000, 2); const g2 = gn(ctx, 0.015);
  src2.connect(f2); f2.connect(g2); g2.connect(out); src2.start();
  stoppable.push(src2); misc.push(f2, g2);
  return { stoppable, misc };
}

function synthInsight(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 28;
  const g1 = gn(ctx, 0.18);
  const { o: l1, g: lg1 } = lfo(ctx, 0.04, 0.14, g1.gain);
  o1.connect(g1); g1.connect(out); o1.start();
  stoppable.push(o1); misc.push(g1, l1, lg1);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 52;
  const g2 = gn(ctx, 0.07);
  const { o: l2, g: lg2 } = lfo(ctx, 0.11, 0.05, g2.gain);
  o2.connect(g2); g2.connect(out); o2.start();
  stoppable.push(o2); misc.push(g2, l2, lg2);
  const brown = makeNoise(ctx, 'brown');
  const src = ctx.createBufferSource(); src.buffer = brown; src.loop = true;
  const f = filt(ctx, 'lowpass', 120, 0.5); const g3 = gn(ctx, 0.06);
  src.connect(f); f.connect(g3); g3.connect(out); src.start();
  stoppable.push(src); misc.push(f, g3);
  return { stoppable, misc };
}

function synthSaturn(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  [180, 290, 420, 640].forEach((freq, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = gn(ctx, 0.04);
    const { o: l, g: lg } = lfo(ctx, 0.05 + i * 0.03, freq * 0.4, o.frequency);
    const { o: la, g: lga } = lfo(ctx, 0.08 + i * 0.025, 0.035, g.gain);
    o.connect(g); g.connect(out); o.start();
    stoppable.push(o, l, la); misc.push(g, lg, lga);
  });
  const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 'white'); src.loop = true;
  const f = filt(ctx, 'bandpass', 350, 0.3); const g4 = gn(ctx, 0.02);
  src.connect(f); f.connect(g4); g4.connect(out); src.start();
  stoppable.push(src); misc.push(f, g4);
  return { stoppable, misc };
}

function synthJupiter(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  [220, 380, 550].forEach((freq, i) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const g = gn(ctx, 0.025);
    const { o: l1, g: lg1 } = lfo(ctx, 0.3 + i * 0.2, freq * 0.6, o.frequency);
    const { o: l2, g: lg2 } = lfo(ctx, 1.5 + i * 0.8, 0.02, g.gain);
    o.connect(g); g.connect(out); o.start();
    stoppable.push(o, l1, l2); misc.push(g, lg1, lg2);
  });
  const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 'white'); src.loop = true;
  const f = filt(ctx, 'bandpass', 1200, 0.8); const g4 = gn(ctx, 0.03);
  const { o: lb, g: lgb } = lfo(ctx, 2.2, 0.025, g4.gain);
  src.connect(f); f.connect(g4); g4.connect(out); src.start();
  stoppable.push(src, lb); misc.push(f, g4, lgb);
  return { stoppable, misc };
}

function synthVoyager(ctx: AudioContext, out: GainNode): SynthResult {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 35;
  const g1 = gn(ctx, 0.16);
  const { o: l1, g: lg1 } = lfo(ctx, 0.03, 8, o1.frequency);
  o1.connect(g1); g1.connect(out); o1.start();
  stoppable.push(o1, l1); misc.push(g1, lg1);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 160;
  const g2 = gn(ctx, 0.05);
  const { o: l2, g: lg2 } = lfo(ctx, 0.015, 80, o2.frequency);
  const { o: la2, g: lga2 } = lfo(ctx, 0.06, 0.04, g2.gain);
  o2.connect(g2); g2.connect(out); o2.start();
  stoppable.push(o2, l2, la2); misc.push(g2, lg2, lga2);
  const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 'white'); src.loop = true;
  const f = filt(ctx, 'lowpass', 400, 0.5); const g3 = gn(ctx, 0.025);
  src.connect(f); f.connect(g3); g3.connect(out); src.start();
  stoppable.push(src); misc.push(f, g3);
  return { stoppable, misc };
}

function startNasaSynth(id: NasaSoundId, ctx: AudioContext, out: GainNode): SynthResult {
  switch (id) {
    case 'mars-wind': return synthMarsWind(ctx, out);
    case 'insight': return synthInsight(ctx, out);
    case 'saturn': return synthSaturn(ctx, out);
    case 'jupiter': return synthJupiter(ctx, out);
    case 'voyager': return synthVoyager(ctx, out);
  }
}

// ═══ Internal channel ref ════════════════════════════════════════

interface ChannelRef {
  gainNode: GainNode | null;
  stoppable: Stoppable[];
  misc: AudioNode[];
  htmlAudio: HTMLAudioElement | null;
  mediaSource: MediaElementAudioSourceNode | null;
}

function emptyRef(): ChannelRef {
  return { gainNode: null, stoppable: [], misc: [], htmlAudio: null, mediaSource: null };
}

// ═══ Hook ════════════════════════════════════════════════════════

export function useSoundMixer() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const masterVolRef = useRef(0.5);
  const chRefs = useRef<Record<string, ChannelRef>>({});

  const [channels, setChannels] = useState<Record<string, ChannelInfo>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [masterVolume, setMasterVolumeState] = useState(50);

  function getCtx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = masterVolRef.current;
      masterRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }

  function getCh(id: string): ChannelRef {
    if (!chRefs.current[id]) chRefs.current[id] = emptyRef();
    return chRefs.current[id];
  }

  function ensureGain(id: string, vol: number): GainNode {
    const ch = getCh(id);
    if (!ch.gainNode) {
      const ctx = getCtx();
      ch.gainNode = ctx.createGain();
      ch.gainNode.connect(masterRef.current!);
    }
    ch.gainNode.gain.value = vol;
    return ch.gainNode;
  }

  function stopCh(id: string) {
    const ch = getCh(id);
    ch.stoppable.forEach(n => { try { n.stop(); n.disconnect(); } catch {} });
    ch.misc.forEach(n => { try { n.disconnect(); } catch {} });
    ch.stoppable = []; ch.misc = [];
    if (ch.htmlAudio) {
      ch.htmlAudio.pause(); ch.htmlAudio.src = '';
      ch.htmlAudio = null;
    }
    if (ch.mediaSource) {
      try { ch.mediaSource.disconnect(); } catch {}
      ch.mediaSource = null;
    }
  }

  async function tryNasaUrls(urls: string[], ch: ChannelRef, chGain: GainNode): Promise<boolean> {
    const ctx = getCtx();
    for (const url of urls) {
      const ok = await new Promise<boolean>(resolve => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.loop = true;
        const timer = setTimeout(() => { audio.src = ''; resolve(false); }, 8000);
        audio.oncanplay = () => {
          clearTimeout(timer);
          audio.play().then(() => {
            ch.htmlAudio = audio;
            try {
              const source = ctx.createMediaElementSource(audio);
              source.connect(chGain);
              ch.mediaSource = source;
            } catch {
              audio.volume = chGain.gain.value * masterVolRef.current;
            }
            resolve(true);
          }).catch(() => { audio.src = ''; resolve(false); });
        };
        audio.onerror = () => { clearTimeout(timer); resolve(false); };
        audio.src = url;
        audio.load();
      });
      if (ok) return true;
    }
    return false;
  }

  async function startCh(id: SoundChannelId, volume: number): Promise<void> {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const chGain = ensureGain(id, volume);
    const ch = getCh(id);

    if (isNasa(id)) {
      setChannels(prev => ({ ...prev, [id]: { active: true, volume, nasaState: 'loading' } }));
      const def = NASA_SOUNDS.find(s => s.id === id);
      if (!def) {
        setChannels(prev => ({ ...prev, [id]: { active: true, volume, nasaState: 'error' } }));
        return;
      }
      const loaded = await tryNasaUrls(def.urls, ch, chGain);
      if (loaded) {
        setChannels(prev => ({ ...prev, [id]: { active: true, volume, nasaState: 'playing' } }));
      } else {
        const nodes = startNasaSynth(id, ctx, chGain);
        ch.stoppable = nodes.stoppable; ch.misc = nodes.misc;
        setChannels(prev => ({ ...prev, [id]: { active: true, volume, nasaState: 'simulated' } }));
      }
    } else {
      const nodes = startAmbientSynth(id as AmbientId, ctx, chGain);
      ch.stoppable = nodes.stoppable; ch.misc = nodes.misc;
      setChannels(prev => ({ ...prev, [id]: { active: true, volume } }));
    }
  }

  const toggle = useCallback(async (id: SoundChannelId) => {
    const ch = chRefs.current[id];
    const isActive = ch && (ch.stoppable.length > 0 || ch.htmlAudio);

    if (isActive) {
      stopCh(id);
      setChannels(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActivePreset(null);
      return;
    }

    setActivePreset(null);
    await startCh(id, 0.5);
  }, []);

  const setChannelVolume = useCallback((id: SoundChannelId, v: number) => {
    const ch = getCh(id);
    if (ch.gainNode && ctxRef.current) {
      ch.gainNode.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.02);
    }
    if (ch.htmlAudio && !ch.mediaSource) {
      ch.htmlAudio.volume = v * masterVolRef.current;
    }
    setChannels(prev => prev[id] ? { ...prev, [id]: { ...prev[id], volume: v } } : prev);
  }, []);

  const setMasterVolume = useCallback((v: number) => {
    masterVolRef.current = v / 100;
    setMasterVolumeState(v);
    if (masterRef.current) {
      masterRef.current.gain.setTargetAtTime(v / 100, masterRef.current.context.currentTime, 0.02);
    }
    Object.entries(chRefs.current).forEach(([, ch]) => {
      if (ch.htmlAudio && !ch.mediaSource) {
        ch.htmlAudio.volume = (ch.gainNode?.gain.value ?? 0.5) * (v / 100);
      }
    });
  }, []);

  const applyPreset = useCallback(async (presetId: string) => {
    Object.keys(chRefs.current).forEach(id => stopCh(id));
    setChannels({});

    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);

    await Promise.all(preset.channels.map(ch => startCh(ch.id, ch.volume)));
  }, []);

  const clearAll = useCallback(() => {
    Object.keys(chRefs.current).forEach(id => stopCh(id));
    setChannels({});
    setActivePreset(null);
  }, []);

  const hasActive = Object.values(channels).some(c => c.active);

  return {
    channels,
    activePreset,
    masterVolume,
    hasActive,
    toggle,
    setChannelVolume,
    setMasterVolume,
    applyPreset,
    clearAll,
  };
}
