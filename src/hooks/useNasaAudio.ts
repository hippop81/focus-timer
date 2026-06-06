import { useRef, useState, useCallback } from 'react';
import { NasaSoundId, NasaPlayState, NASA_SOUNDS } from '../types';

// ── synthesis fallbacks ────────────────────────────────────────────
type Stoppable = AudioBufferSourceNode | OscillatorNode;
interface SynthNodes { stoppable: Stoppable[]; misc: AudioNode[]; }

function makeNoise(ctx: AudioContext, type: 'white' | 'brown', secs = 4): AudioBuffer {
  const len = ctx.sampleRate * secs;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function filt(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
}
function gain(ctx: AudioContext, v: number): GainNode {
  const g = ctx.createGain(); g.gain.value = v; return g;
}
function lfo(ctx: AudioContext, hz: number, amp: number, target: AudioParam) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
  const g = ctx.createGain(); g.gain.value = amp;
  o.connect(g); g.connect(target); o.start(); return { o, g };
}

function synthMarsWind(ctx: AudioContext, master: GainNode): SynthNodes {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Mars: thin CO₂ atmosphere → higher-pitched, wispy wind
  const brown = makeNoise(ctx, 'brown');
  const white = makeNoise(ctx, 'white');
  const src1 = ctx.createBufferSource(); src1.buffer = brown; src1.loop = true;
  const f1 = filt(ctx, 'highpass', 600, 0.4);
  const f1b = filt(ctx, 'lowpass', 3000, 0.5);
  const g1 = gain(ctx, 0.22);
  const { o: l1, g: lg1 } = lfo(ctx, 0.08, 0.1, g1.gain);
  src1.connect(f1); f1.connect(f1b); f1b.connect(g1); g1.connect(master); src1.start();
  stoppable.push(src1); misc.push(f1, f1b, g1, l1, lg1);
  // Subtle high-frequency crackle (dust particles)
  const src2 = ctx.createBufferSource(); src2.buffer = white; src2.loop = true;
  const f2 = filt(ctx, 'bandpass', 5000, 2);
  const g2 = gain(ctx, 0.015);
  src2.connect(f2); f2.connect(g2); g2.connect(master); src2.start();
  stoppable.push(src2); misc.push(f2, g2);
  return { stoppable, misc };
}

function synthInsight(ctx: AudioContext, master: GainNode): SynthNodes {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // InSight seismometer: sped-up low-frequency Martian quake
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 28;
  const g1 = gain(ctx, 0.18);
  const { o: l1, g: lg1 } = lfo(ctx, 0.04, 0.14, g1.gain);
  o1.connect(g1); g1.connect(master); o1.start();
  stoppable.push(o1); misc.push(g1, l1, lg1);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 52;
  const g2 = gain(ctx, 0.07);
  const { o: l2, g: lg2 } = lfo(ctx, 0.11, 0.05, g2.gain);
  o2.connect(g2); g2.connect(master); o2.start();
  stoppable.push(o2); misc.push(g2, l2, lg2);
  // Very low rumble noise
  const brown = makeNoise(ctx, 'brown');
  const src = ctx.createBufferSource(); src.buffer = brown; src.loop = true;
  const f = filt(ctx, 'lowpass', 120, 0.5);
  const gn = gain(ctx, 0.06);
  src.connect(f); f.connect(gn); gn.connect(master); src.start();
  stoppable.push(src); misc.push(f, gn);
  return { stoppable, misc };
}

function synthSaturn(ctx: AudioContext, master: GainNode): SynthNodes {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Saturn radio emissions: sweeping FM tones (SKR)
  const carriers = [180, 290, 420, 640];
  carriers.forEach((freq, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = gain(ctx, 0.04);
    // Each carrier sweeps at a slightly different rate
    const { o: l, g: lg } = lfo(ctx, 0.05 + i * 0.03, freq * 0.4, o.frequency);
    const { o: la, g: lga } = lfo(ctx, 0.08 + i * 0.025, 0.035, g.gain);
    o.connect(g); g.connect(master); o.start();
    stoppable.push(o, l, la); misc.push(g, lg, lga);
  });
  // Noise floor
  const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 'white'); src.loop = true;
  const f = filt(ctx, 'bandpass', 350, 0.3);
  const gn = gain(ctx, 0.02);
  src.connect(f); f.connect(gn); gn.connect(master); src.start();
  stoppable.push(src); misc.push(f, gn);
  return { stoppable, misc };
}

function synthJupiter(ctx: AudioContext, master: GainNode): SynthNodes {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Jupiter radio: whistlers + lightning bursts
  const baseFreqs = [220, 380, 550];
  baseFreqs.forEach((freq, i) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const g = gain(ctx, 0.025);
    const { o: l1, g: lg1 } = lfo(ctx, 0.3 + i * 0.2, freq * 0.6, o.frequency);
    const { o: l2, g: lg2 } = lfo(ctx, 1.5 + i * 0.8, 0.02, g.gain);
    o.connect(g); g.connect(master); o.start();
    stoppable.push(o, l1, l2); misc.push(g, lg1, lg2);
  });
  // Static bursts
  const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 'white'); src.loop = true;
  const f = filt(ctx, 'bandpass', 1200, 0.8);
  const gn = gain(ctx, 0.03);
  const { o: lb, g: lgb } = lfo(ctx, 2.2, 0.025, gn.gain);
  src.connect(f); f.connect(gn); gn.connect(master); src.start();
  stoppable.push(src, lb); misc.push(f, gn, lgb);
  return { stoppable, misc };
}

function synthVoyager(ctx: AudioContext, master: GainNode): SynthNodes {
  const stoppable: Stoppable[] = []; const misc: AudioNode[] = [];
  // Interstellar plasma waves: deep space drone with plasma frequency chirps
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 35;
  const g1 = gain(ctx, 0.16);
  const { o: l1, g: lg1 } = lfo(ctx, 0.03, 8, o1.frequency);
  o1.connect(g1); g1.connect(master); o1.start();
  stoppable.push(o1, l1); misc.push(g1, lg1);
  // Plasma frequency sweep
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 160;
  const g2 = gain(ctx, 0.05);
  const { o: l2, g: lg2 } = lfo(ctx, 0.015, 80, o2.frequency);
  const { o: la2, g: lga2 } = lfo(ctx, 0.06, 0.04, g2.gain);
  o2.connect(g2); g2.connect(master); o2.start();
  stoppable.push(o2, l2, la2); misc.push(g2, lg2, lga2);
  // Very quiet background hiss
  const src = ctx.createBufferSource(); src.buffer = makeNoise(ctx, 'white'); src.loop = true;
  const f = filt(ctx, 'lowpass', 400, 0.5);
  const gn = gain(ctx, 0.025);
  src.connect(f); f.connect(gn); gn.connect(master); src.start();
  stoppable.push(src); misc.push(f, gn);
  return { stoppable, misc };
}

// ── main hook ─────────────────────────────────────────────────────
export function useNasaAudio() {
  const [activeId, setActiveId] = useState<NasaSoundId | null>(null);
  const [playState, setPlayState] = useState<NasaPlayState>('idle');

  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const synthNodesRef = useRef<SynthNodes>({ stoppable: [], misc: [] });
  const volumeRef = useRef(0.5);

  function stopHtmlAudio() {
    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.src = '';
      htmlAudioRef.current.oncanplay = null;
      htmlAudioRef.current.onerror = null;
      htmlAudioRef.current = null;
    }
  }

  function stopSynth() {
    const n = synthNodesRef.current;
    n.stoppable.forEach(s => { try { s.stop(); s.disconnect(); } catch {} });
    n.misc.forEach(m => { try { m.disconnect(); } catch {} });
    synthNodesRef.current = { stoppable: [], misc: [] };
  }

  function getSynthCtx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = volumeRef.current;
      masterRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }

  function startSynthesis(id: NasaSoundId) {
    stopSynth();
    const ctx = getSynthCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const master = masterRef.current!;
    let nodes: SynthNodes;
    if (id === 'mars-wind') nodes = synthMarsWind(ctx, master);
    else if (id === 'insight') nodes = synthInsight(ctx, master);
    else if (id === 'saturn') nodes = synthSaturn(ctx, master);
    else if (id === 'jupiter') nodes = synthJupiter(ctx, master);
    else nodes = synthVoyager(ctx, master);
    synthNodesRef.current = nodes;
    setPlayState('simulated');
  }

  async function tryUrls(_id: NasaSoundId, urls: string[]): Promise<boolean> {
    for (const url of urls) {
      const success = await new Promise<boolean>(resolve => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.loop = true;
        audio.volume = volumeRef.current;
        const timer = setTimeout(() => { audio.src = ''; resolve(false); }, 8000);
        audio.oncanplay = () => {
          clearTimeout(timer);
          audio.play().then(() => {
            htmlAudioRef.current = audio;
            resolve(true);
          }).catch(() => { audio.src = ''; resolve(false); });
        };
        audio.onerror = () => { clearTimeout(timer); resolve(false); };
        audio.src = url;
        audio.load();
      });
      if (success) return true;
    }
    return false;
  }

  const play = useCallback(async (id: NasaSoundId) => {
    stopHtmlAudio();
    stopSynth();
    setActiveId(id);
    setPlayState('loading');

    const def = NASA_SOUNDS.find(s => s.id === id);
    if (!def) { setPlayState('error'); return; }

    const loaded = await tryUrls(id, def.urls);
    if (loaded) {
      setPlayState('playing');
    } else {
      startSynthesis(id);
    }
  }, []);

  const stop = useCallback(() => {
    stopHtmlAudio();
    stopSynth();
    setActiveId(null);
    setPlayState('idle');
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    if (htmlAudioRef.current) htmlAudioRef.current.volume = v;
    if (masterRef.current) {
      masterRef.current.gain.setTargetAtTime(v, masterRef.current.context.currentTime, 0.02);
    }
  }, []);

  return { play, stop, setVolume, activeId, playState };
}
