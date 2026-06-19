import { useRef, useCallback } from 'react';
import { SoundType } from '../types';

type Stoppable = AudioBufferSourceNode | OscillatorNode;

interface ActiveNodes {
  stoppable: Stoppable[];
  misc: AudioNode[];
}

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
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6 = w*0.115926;
    }
  }
  return buf;
}

function loopSrc(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true; return src;
}

function lpf(ctx: AudioContext, freq: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=freq; f.Q.value=q; return f;
}
function bpf(ctx: AudioContext, freq: number, q = 1): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=q; return f;
}
function hpf(ctx: AudioContext, freq: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=freq; return f;
}
function gainNode(ctx: AudioContext, v: number): GainNode {
  const g = ctx.createGain(); g.gain.value=v; return g;
}
function lfo(ctx: AudioContext, freq: number, amp: number, target: AudioParam) {
  const osc = ctx.createOscillator(); osc.type='sine'; osc.frequency.value=freq;
  const g = ctx.createGain(); g.gain.value=amp;
  osc.connect(g); g.connect(target); osc.start(); return { osc, g };
}

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const activeRef = useRef<ActiveNodes>({ stoppable: [], misc: [] });
  const volumeRef = useRef(0.5);

  function ctx(): AudioContext {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = volumeRef.current;
      masterRef.current.connect(ctxRef.current.destination);
    }
    return ctxRef.current;
  }

  function master(): GainNode { return masterRef.current!; }

  function stopAll() {
    activeRef.current.stoppable.forEach(n => { try { n.stop(); n.disconnect(); } catch {} });
    activeRef.current.misc.forEach(n => { try { n.disconnect(); } catch {} });
    activeRef.current = { stoppable: [], misc: [] };
  }

  function reg(s: Stoppable, ...misc: AudioNode[]) {
    activeRef.current.stoppable.push(s);
    activeRef.current.misc.push(...misc);
  }

  function layer(buf: AudioBuffer, filter: BiquadFilterNode, vol: number): AudioBufferSourceNode {
    const c = ctx(); const m = master();
    const src = loopSrc(c, buf);
    const g = gainNode(c, vol);
    src.connect(filter); filter.connect(g); g.connect(m);
    src.start(); reg(src, filter, g); return src;
  }

  function setupRain() {
    const c = ctx(); const brown = makeNoise(c, 'brown'); const white = makeNoise(c, 'white');
    layer(brown, lpf(c, 1000, 0.4), 0.38);
    layer(brown, lpf(c, 180, 0.5), 0.18);
    layer(white, bpf(c, 2800, 1.8), 0.04);
  }

  function setupForest() {
    const c = ctx(); const m = master(); const pink = makeNoise(c, 'pink');
    layer(pink, lpf(c, 700, 0.5), 0.12);
    const src2 = loopSrc(c, pink);
    const f2 = bpf(c, 380, 0.6);
    const g2 = gainNode(c, 0.09);
    const { osc: l1, g: lg1 } = lfo(c, 0.15, 0.06, g2.gain);
    src2.connect(f2); f2.connect(g2); g2.connect(m); src2.start();
    reg(src2, f2, g2, l1, lg1);
  }

  function setupOcean() {
    const c = ctx(); const m = master();
    const brown = makeNoise(c, 'brown', 6); const white = makeNoise(c, 'white');
    const src1 = loopSrc(c, brown);
    const f1 = lpf(c, 550, 0.4);
    const g1 = gainNode(c, 0.22);
    const { osc: l1, g: lg1 } = lfo(c, 0.11, 0.14, g1.gain);
    src1.connect(f1); f1.connect(g1); g1.connect(m); src1.start();
    reg(src1, f1, g1, l1, lg1);
    layer(brown, lpf(c, 90), 0.18);
    layer(white, hpf(c, 3200), 0.015);
  }

  function setupCafe() {
    const c = ctx(); const m = master(); const pink = makeNoise(c, 'pink');
    const src1 = loopSrc(c, pink);
    const f1 = bpf(c, 900, 0.6);
    const g1 = gainNode(c, 0.1);
    const { osc: l1, g: lg1 } = lfo(c, 0.28, 0.045, g1.gain);
    src1.connect(f1); f1.connect(g1); g1.connect(m); src1.start();
    reg(src1, f1, g1, l1, lg1);
    layer(pink, lpf(c, 280, 0.5), 0.08);
    layer(makeNoise(c, 'white'), bpf(c, 4200, 3), 0.004);
  }

  function setupWhiteNoise() {
    const c = ctx(); const buf = makeNoise(c, 'white');
    layer(buf, lpf(c, 12000), 0.18);
  }

  function setupDeepFocus() {
    const c = ctx(); const m = master();
    const buildOsc = (freq: number, vol: number): OscillatorNode => {
      const o = c.createOscillator(); o.type='sine'; o.frequency.value=freq;
      const g = gainNode(c, vol);
      const { osc: l, g: lg } = lfo(c, 0.07, vol*0.4, g.gain);
      o.connect(g); g.connect(m); o.start();
      reg(o, g, l, lg); return o;
    };
    buildOsc(40, 0.14); buildOsc(80, 0.06); buildOsc(120, 0.025);
    layer(makeNoise(c, 'pink'), lpf(c, 220, 0.5), 0.04);
  }

  const play = useCallback(async (type: SoundType) => {
    stopAll();
    if (type === 'none') return;
    const c = ctx();
    if (c.state === 'suspended') await c.resume();
    if (type === 'rain') setupRain();
    else if (type === 'forest') setupForest();
    else if (type === 'ocean') setupOcean();
    else if (type === 'cafe') setupCafe();
    else if (type === 'whitenoise') setupWhiteNoise();
    else if (type === 'deepfocus') setupDeepFocus();
  }, []);

  const stop = useCallback(() => stopAll(), []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    if (masterRef.current) {
      masterRef.current.gain.setTargetAtTime(v, masterRef.current.context.currentTime, 0.02);
    }
  }, []);

  return { play, stop, setVolume };
}
