// Procedural WebAudio sound effects and synthwave radio generator
// 100% synthesized - zero external audio assets

class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.radioEnabled = true;

    // Active continuous sound nodes
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.radioInterval = null;
    this.radioGain = null;
    this.radioStep = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch (e) {
      console.warn('AudioContext failed to initialize', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Gunshot: noise burst + pitch envelope + low end punch
  playGunshot() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.03));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(4500, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);

    // Low punch
    const punchOsc = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(180, now);
    punchOsc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

    punchGain.gain.setValueAtTime(0.8, now);
    punchGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    punchOsc.connect(punchGain);
    punchGain.connect(this.ctx.destination);
    punchOsc.start(now);
    punchOsc.stop(now + 0.13);
  }

  // Melee punch impact
  playPunch() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Car engine sound
  startEngine() {
    if (!this.ctx || this.engineOsc || this.muted) return;
    const now = this.ctx.currentTime;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(45, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    this.engineGain.gain.setValueAtTime(0.12, now);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  updateEngine(speedFraction) {
    if (!this.engineOsc || !this.ctx) return;
    const targetFreq = 40 + Math.min(180, speedFraction * 140);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // Police Siren
  startSiren() {
    if (!this.ctx || this.sirenOsc || this.muted) return;
    const now = this.ctx.currentTime;

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenLfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    this.sirenGain = this.ctx.createGain();

    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.setValueAtTime(750, now);

    this.sirenLfo.type = 'triangle';
    this.sirenLfo.frequency.setValueAtTime(1.8, now); // ~1.8 Hz sweep

    lfoGain.gain.setValueAtTime(220, now); // Swing 530Hz to 970Hz

    this.sirenLfo.connect(this.sirenOsc.frequency);
    this.sirenGain.gain.setValueAtTime(0.15, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    this.sirenOsc.connect(filter);
    filter.connect(this.sirenGain);
    this.sirenGain.connect(this.ctx.destination);

    this.sirenLfo.start();
    this.sirenOsc.start();
  }

  stopSiren() {
    if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
        this.sirenOsc.disconnect();
        this.sirenLfo.disconnect();
      } catch (e) {}
      this.sirenOsc = null;
      this.sirenLfo = null;
      this.sirenGain = null;
    }
  }

  // Tire screech
  playScreech() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(6, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // Car Horn
  playHorn() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(370, now);
    osc2.frequency.setValueAtTime(440, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  // Footstep
  playFootstep() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Cash pickup chime
  playCash() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = [987.77, 1318.51]; // B5, E6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.2, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.22);
    });
  }

  // Mission Passed Fanfare
  playMissionPass() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // C major triumph chord arpeggio: C4, E4, G4, C5
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);

      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.65);
    });
  }

  // Procedural Synthwave Radio Music
  startRadio() {
    if (!this.ctx || !this.radioEnabled || this.radioInterval) return;
    const tempo = 115; // BPM
    const stepDuration = 60 / tempo / 2; // Eighth note

    // Synthwave bass notes (D minor / F / G / A progression)
    const bassline = [
      146.83, 146.83, 220.00, 146.83,
      174.61, 174.61, 261.63, 174.61,
      196.00, 196.00, 293.66, 196.00,
      220.00, 220.00, 329.63, 220.00
    ];

    this.radioInterval = setInterval(() => {
      if (this.muted || !this.radioEnabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = bassline[this.radioStep % bassline.length];
      this.radioStep++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq / 2, now); // Warm bass octave

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + stepDuration * 0.9);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + stepDuration * 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + stepDuration);
    }, stepDuration * 1000);
  }

  stopRadio() {
    if (this.radioInterval) {
      clearInterval(this.radioInterval);
      this.radioInterval = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngine();
      this.stopSiren();
    }
    return !this.muted;
  }

  toggleRadio() {
    this.radioEnabled = !this.radioEnabled;
    if (!this.radioEnabled) {
      this.stopRadio();
    } else {
      this.startRadio();
    }
    return this.radioEnabled;
  }
}

export const audio = new AudioManager();
