import type { ParState } from '../sim/types';

/**
 * Procedural Scientific Sound Synthesizer (100% Web Audio API, zero external files).
 */
class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private unlocked = false;

  // Continuous nodes
  private masterGain: GainNode | null = null;
  private hissGain: GainNode | null = null;
  private rfHumGain: GainNode | null = null;
  private rfOsc1: OscillatorNode | null = null;
  private rfOsc2: OscillatorNode | null = null;
  private rfLfo: OscillatorNode | null = null;

  private lastState: ParState = 'SAFE';
  private lastPulse: 0 | 1 = 0;
  private lastDropletTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.unlock();
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next) {
      this.unlock();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(next ? 0.55 : 0.0, this.ctx.currentTime, 0.04);
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupContinuousGraph();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  private setupContinuousGraph(): void {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.enabled ? 0.55 : 0.0;
    this.masterGain.connect(this.ctx.destination);

    // 1. Pressurized H2 gas hiss (filtered white noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2850;
    bandpass.Q.value = 1.6;

    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = 0;

    noiseSource.connect(bandpass);
    bandpass.connect(this.hissGain);
    this.hissGain.connect(this.masterGain);
    noiseSource.start();

    // 2. RF Electromagnetic Induction Hum (110 Hz + 220 Hz + subtle LFO)
    this.rfHumGain = this.ctx.createGain();
    this.rfHumGain.gain.value = 0;

    this.rfOsc1 = this.ctx.createOscillator();
    this.rfOsc1.type = 'sine';
    this.rfOsc1.frequency.value = 110;

    this.rfOsc2 = this.ctx.createOscillator();
    this.rfOsc2.type = 'triangle';
    this.rfOsc2.frequency.value = 220;

    const rfFilter = this.ctx.createBiquadFilter();
    rfFilter.type = 'lowpass';
    rfFilter.frequency.value = 420;

    this.rfLfo = this.ctx.createOscillator();
    this.rfLfo.frequency.value = 6.5;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.015;
    this.rfLfo.connect(lfoDepth);
    lfoDepth.connect(this.rfHumGain.gain);

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = 0.25;

    this.rfOsc1.connect(rfFilter);
    this.rfOsc2.connect(osc2Gain);
    osc2Gain.connect(rfFilter);
    rfFilter.connect(this.rfHumGain);
    this.rfHumGain.connect(this.masterGain);

    this.rfOsc1.start();
    this.rfOsc2.start();
    this.rfLfo.start();
  }

  public updateTelemetry(h2: number, state: ParState, pulse: 0 | 1): void {
    if (!this.ctx || !this.unlocked || !this.enabled || !this.hissGain || !this.rfHumGain) {
      this.lastState = state;
      this.lastPulse = pulse;
      return;
    }

    const now = this.ctx.currentTime;

    // Soft pressurized hiss proportional to H2%
    const targetHiss = state === 'EXPLOSION' ? 0 : Math.min(0.085, Math.max(0, (h2 - 0.15) * 0.015));
    this.hissGain.gain.setTargetAtTime(targetHiss, now, 0.12);

    // Sleek RF hum when pulse === 1
    const targetHum = pulse === 1 && state !== 'EXPLOSION' ? 0.095 : 0;
    this.rfHumGain.gain.setTargetAtTime(targetHum, now, 0.08);

    // State transition cues
    if (pulse === 1 && this.lastPulse === 0) {
      this.playRfPowerUpChime();
    }
    if (state === 'FAILSAFE' && this.lastState !== 'FAILSAFE') {
      this.playFailsafeAlert();
    }
    if (state === 'EXPLOSION' && this.lastState !== 'EXPLOSION') {
      this.playExplosionBlast();
    }

    this.lastState = state;
    this.lastPulse = pulse;
  }

  public playRfPowerUpChime(): void {
    if (!this.ctx || !this.enabled || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const freqs = [330, 495, 660];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.055);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.055 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.45);
    });
  }

  public playRecombinationDroplet(): void {
    if (!this.ctx || !this.enabled || !this.masterGain) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDropletTime < 0.14) return;
    this.lastDropletTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const baseFreq = 920 + Math.random() * 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.075);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playFailsafeAlert(): void {
    if (!this.ctx || !this.enabled || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [0, 0.22].forEach((offset, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? 660 : 528, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.11, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.17);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.19);
    });
  }

  public playExplosionBlast(): void {
    if (!this.ctx || !this.enabled || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sub-bass pressure thump
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.65);
    oscGain.gain.setValueAtTime(0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.9);

    // Filtered noise shockwave
    const bufLen = Math.floor(this.ctx.sampleRate * 0.9);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.24));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(950, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + 0.7);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
  }

  public playUiClick(): void {
    this.unlock();
    if (!this.ctx || !this.enabled || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.022);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.032);
  }
}

export const soundEngine = new ProceduralSoundEngine();
