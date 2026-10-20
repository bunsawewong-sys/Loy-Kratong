// All sound is synthesised with the Web Audio API, so there are no audio files to license
// or download. Browsers only allow audio after a user gesture: call unlock() from a click.

const PENTATONIC = [0, 2, 4, 7, 9]; // Thai-flavoured five-note scale
const BASE_FREQ = 261.63; // C4

function noteFreq(step: number): number {
  const octave = Math.floor(step / PENTATONIC.length);
  const degree = ((step % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length;
  return BASE_FREQ * 2 ** (octave + PENTATONIC[degree] / 12);
}

class Sound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private musicTimer?: number;
  private nextNoteAt = 0;
  private step = 0;
  private enabled = true;
  private volume = 0.6;

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = this.enabled ? v : 0;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.volume : 0;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
  }

  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType, dest?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(dest ?? this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private noise(at: number, dur: number, gain: number, from: number, to: number): void {
    if (!this.ctx || !this.master) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(at);
  }

  /** Gentle plucked pentatonic loop (like a khim), for the big screen. */
  startMusic(): void {
    if (!this.ctx || !this.master || this.musicTimer !== undefined) return;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    // A fixed phrase so the loop sounds composed rather than random.
    const phrase = [5, 7, 8, 7, 5, 4, 2, 4, 5, 4, 2, 0, 2, 4, 5, -1, 7, 8, 10, 8, 7, 5, 4, 5, 4, 2, 4, 5, 2, 0, -1, -1];
    const beat = 60 / 76 / 2;
    const schedule = () => {
      if (!this.ctx || !this.musicGain) return;
      while (this.nextNoteAt < this.ctx.currentTime + 0.4) {
        const step = phrase[this.step % phrase.length];
        if (step >= 0) {
          const f = noteFreq(step);
          this.tone(f, this.nextNoteAt, 1.4, 0.14, 'triangle', this.musicGain);
          this.tone(f * 2.003, this.nextNoteAt, 0.5, 0.03, 'sine', this.musicGain);
        }
        if (this.step % 8 === 0) {
          const root = this.step % 32 < 16 ? 0 : -2;
          this.tone(noteFreq(root - 5), this.nextNoteAt, beat * 8, 0.08, 'sine', this.musicGain);
          this.tone(noteFreq(root - 2), this.nextNoteAt, beat * 8, 0.04, 'sine', this.musicGain);
        }
        this.step++;
        this.nextNoteAt += beat;
      }
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, 150);
  }

  stopMusic(): void {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.musicGain?.disconnect();
    this.musicGain = undefined;
  }

  splash(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.6, 0.35, 2500, 200);
    this.tone(noteFreq(7), t + 0.05, 0.6, 0.08, 'sine');
  }

  chime(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(noteFreq(10), t, 0.8, 0.12, 'sine');
    this.tone(noteFreq(12), t + 0.09, 0.9, 0.1, 'sine');
  }

  tap(): void {
    if (!this.ctx) return;
    this.tone(noteFreq(9), this.ctx.currentTime, 0.18, 0.06, 'triangle');
  }

  boom(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 1.2, 0.5, 900, 60);
    this.tone(70, t, 0.6, 0.25, 'sine');
  }
}

export const sound = new Sound();
