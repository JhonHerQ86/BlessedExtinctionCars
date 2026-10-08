/**
 * Audio system. Every sound is synthesized with the Web Audio API by default
 * (no copyrighted material). To use real files, drop them in
 * public/assets/audio/ with these names — they are picked up automatically:
 *
 *   music.mp3      looping background music (replaces synth metal loop)
 *   crash.mp3      explosion.mp3   pickup.mp3   splat.mp3   zombie.mp3
 *   brake.mp3      beep.mp3        go.mp3
 *   nitro_blessed.mp3 / nitro_gonorrea.mp3   shouted voice lines for the nitro
 *
 * MUSIC PLAYLIST (e.g. tracks downloaded from your Bandcamp purchases/uploads):
 *   put the .mp3 files in public/assets/audio/music/ and list them in
 *   public/assets/audio/music/playlist.json  →  ["track1.mp3", "track2.mp3"]
 *   Tracks play shuffled, one after another. Priority: playlist > music.mp3 > synth.
 */

const BASE = import.meta.env.BASE_URL || './';
const FILES = ['music', 'crash', 'explosion', 'pickup', 'splat', 'zombie', 'brake', 'beep', 'go', 'nitro_blessed', 'nitro_gonorrea'];
const VOICE_LINES = [['nitro_blessed', 'Blessed Extinction!'], ['nitro_gonorrea', '¡Gonorrea!']];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.volumes = { master: 0.8, music: 0.5, sfx: 0.8 };
    this.enabled = true;
    this.engineNodes = null;
    this.musicTimer = null;
    this.lastBrake = 0;
  }

  /** Must be called from a user gesture (click / key). Safe to call often. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyVolumes();

    // Shared white-noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Distortion curve for the metal riff
    const n = 1024;
    this.distCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1;
      this.distCurve[i] = Math.tanh(x * 6);
    }
    this.loadFiles();
  }

  loadFiles() {
    this.playlist = [];
    this.playlistReady = fetch(`${BASE}assets/audio/music/playlist.json`)
      .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : []))
      .then((list) => { this.playlist = Array.isArray(list) ? list.filter((f) => typeof f === 'string') : []; })
      .catch(() => {});
    for (const name of FILES) {
      fetch(`${BASE}assets/audio/${name}.mp3`)
        .then((r) => {
          if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) throw new Error('missing');
          return r.arrayBuffer();
        })
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((buf) => { this.buffers[name] = buf; })
        .catch(() => {});
    }
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.enabled ? this.volumes.master : 0;
    this.musicGain.gain.value = this.volumes.music * 0.6;
    this.sfxGain.gain.value = this.volumes.sfx;
  }

  get t() {
    return this.ctx.currentTime;
  }

  playBuffer(name, vol = 1, rate = 1) {
    const buf = this.buffers[name];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.sfxGain);
    src.start();
    return true;
  }

  noiseBurst(dur, vol, filterType, f0, f1, q = 1) {
    const ctx = this.ctx, t = this.t;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tone(type, f0, f1, dur, vol, dest = this.sfxGain, when = 0) {
    const ctx = this.ctx, t = this.t + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /* ----------------------------------------------------------- SFX */

  crash(intensity = 1) {
    if (!this.ctx) return;
    if (this.playBuffer('crash', intensity)) return;
    this.noiseBurst(0.35 + intensity * 0.3, 0.7 * intensity, 'lowpass', 2400, 200);
    this.tone('square', 90, 35, 0.25, 0.35 * intensity);
  }

  explosion(intensity = 1) {
    if (!this.ctx) return;
    if (this.playBuffer('explosion', intensity)) return;
    this.noiseBurst(1.8, 1.0 * intensity, 'lowpass', 1600, 60);
    this.tone('sine', 70, 25, 1.0, 0.8 * intensity);
    this.noiseBurst(0.5, 0.4 * intensity, 'highpass', 3000, 1200);
  }

  pickup() {
    if (!this.ctx) return;
    if (this.playBuffer('pickup')) return;
    this.tone('triangle', 520, 780, 0.12, 0.35);
    this.tone('triangle', 780, 1170, 0.18, 0.3, this.sfxGain, 0.09);
  }

  splat() {
    if (!this.ctx) return;
    if (this.playBuffer('splat')) return;
    this.noiseBurst(0.18, 0.5, 'bandpass', 600, 150, 2);
    this.tone('sine', 140, 50, 0.15, 0.4);
  }

  zombie() {
    if (!this.ctx) return;
    if (this.playBuffer('zombie', 0.6, 0.85 + Math.random() * 0.3)) return;
    const ctx = this.ctx, t = this.t;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 80 + Math.random() * 40;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 0.7, t + 1.1);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 7;
    const lg = ctx.createGain();
    lg.gain.value = 12;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(f).connect(g).connect(this.sfxGain);
    o.start(t); lfo.start(t);
    o.stop(t + 1.3); lfo.stop(t + 1.3);
  }

  brake() {
    if (!this.ctx || this.t - this.lastBrake < 0.6) return;
    this.lastBrake = this.t;
    if (this.playBuffer('brake', 0.5)) return;
    this.noiseBurst(0.45, 0.18, 'bandpass', 3200, 2200, 8);
  }

  /** Shouted voice line for the nitro: recorded file if present, else speech synthesis. */
  nitroVoice() {
    if (!this.ctx) return;
    const [file, text] = VOICE_LINES[Math.floor(Math.random() * VOICE_LINES.length)];
    if (this.playBuffer(file, 1.2)) return;
    const other = VOICE_LINES.find(([f]) => this.buffers[f]);
    if (other && this.playBuffer(other[0], 1.2)) return;
    const synth = window.speechSynthesis;
    if (!synth || !this.enabled) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 1.15;
      u.pitch = 0.2; // deep, growly
      u.volume = Math.min(1, this.volumes.master * this.volumes.sfx * 1.5);
      const voices = synth.getVoices().filter((v) => v.lang.startsWith('en'));
      const male = voices.find((v) => /male|david|daniel|fred|alex/i.test(v.name));
      if (male || voices[0]) u.voice = male || voices[0];
      synth.speak(u);
    } catch { /* speech not available */ }
  }

  beep(go = false) {
    if (!this.ctx) return;
    if (this.playBuffer(go ? 'go' : 'beep')) return;
    this.tone('square', go ? 880 : 440, go ? 880 : 440, go ? 0.5 : 0.18, 0.25);
  }

  /* ----------------------------------------------------------- ENGINE + WIND */

  startEngine() {
    if (!this.ctx || this.engineNodes) return;
    const ctx = this.ctx;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.value = 40; o2.frequency.value = 40.5;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    const g = ctx.createGain(); g.gain.value = 0.0;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o1.connect(f); o2.connect(g2).connect(f);
    f.connect(g).connect(this.sfxGain);
    // Wind = filtered noise whose volume grows with speed
    const w = ctx.createBufferSource();
    w.buffer = this.noise; w.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 800; wf.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0;
    w.connect(wf).connect(wg).connect(this.sfxGain);
    o1.start(); o2.start(); w.start();
    this.engineNodes = { o1, o2, f, g, w, wf, wg };
  }

  updateEngine(speedRatio, throttle) {
    const n = this.engineNodes;
    if (!n) return;
    const t = this.t;
    const freq = 38 + speedRatio * 110 + (throttle ? 12 : 0);
    n.o1.frequency.setTargetAtTime(freq, t, 0.08);
    n.o2.frequency.setTargetAtTime(freq * 1.01, t, 0.08);
    n.f.frequency.setTargetAtTime(300 + speedRatio * 1200 + (throttle ? 300 : 0), t, 0.1);
    n.g.gain.setTargetAtTime(0.1 + speedRatio * 0.12, t, 0.1);
    n.wg.gain.setTargetAtTime(speedRatio * speedRatio * 0.16, t, 0.2);
    n.wf.frequency.setTargetAtTime(500 + speedRatio * 1500, t, 0.2);
  }

  stopEngine() {
    const n = this.engineNodes;
    if (!n) return;
    try { n.o1.stop(); n.o2.stop(); n.w.stop(); } catch { /* already stopped */ }
    this.engineNodes = null;
  }

  /* ----------------------------------------------------------- MUSIC */

  /** Dark synth "death metal" loop: distorted palm-muted chugs + drone + kick. */
  /** Streams the user playlist through an <audio> element (no full decode needed). */
  playPlaylist() {
    this.ensureMusicEl();
    this.musicEl.loop = false;
    this.nextTrack();
  }

  nextTrack() {
    if (!this.playlist.length || !this.musicEl) return;
    if (!this.order.length) this.order = this.playlist.slice().sort(() => Math.random() - 0.5);
    this.musicEl.src = `${BASE}assets/audio/music/${encodeURIComponent(this.order.shift())}`;
    this.musicEl.play().catch(() => {});
  }

  /** Ensure the shared <audio> element exists and is routed through the music volume. */
  ensureMusicEl() {
    if (this.musicEl) return;
    this.musicEl = new Audio();
    this.musicEl.crossOrigin = 'anonymous';
    this.ctx.createMediaElementSource(this.musicEl).connect(this.musicGain);
    this.musicEl.addEventListener('ended', () => { if (!this.musicEl.loop) this.nextTrack(); });
    this.order = [];
  }

  /** Level track from a local file: loops, autoplays on race start. Resolves true if it exists. */
  async playLevelTrack(path) {
    if (!this.ctx) return false;
    try {
      const r = await fetch(`${BASE}${path}`, { method: 'HEAD' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('audio')) return false;
    } catch { return false; }
    this.ensureMusicEl();
    this.musicEl.loop = true;
    this.musicEl.src = `${BASE}${path}`;
    this.musicPlaying = true;
    this.trackPaused = false;
    await this.musicEl.play().catch(() => {});
    return true;
  }

  /** Toggle the level track (our own pause button). Returns true if now playing. */
  toggleLevelTrack() {
    if (!this.musicEl) return false;
    this.trackPaused = !this.trackPaused;
    if (this.trackPaused) this.musicEl.pause();
    else this.musicEl.play().catch(() => {});
    return !this.trackPaused;
  }

  startMusic() {
    if (!this.ctx || this.musicTimer || this.musicSrc || this.musicPlaying) return;
    this.musicPlaying = true;
    (this.playlistReady || Promise.resolve()).then(() => {
      if (!this.musicPlaying) return;
      if (this.playlist.length) this.playPlaylist();
      else this.startBuiltInMusic();
    });
  }

  startBuiltInMusic() {
    if (this.musicTimer || this.musicSrc) return;
    if (this.buffers.music) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.music; src.loop = true;
      src.connect(this.musicGain); src.start();
      this.musicSrc = src;
      return;
    }
    const ctx = this.ctx;
    // Drone
    const d1 = ctx.createOscillator(), d2 = ctx.createOscillator();
    d1.type = 'sawtooth'; d2.type = 'sawtooth';
    d1.frequency.value = 41.2; d2.frequency.value = 41.5;
    const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 220;
    const dg = ctx.createGain(); dg.gain.value = 0.25;
    d1.connect(df); d2.connect(df); df.connect(dg).connect(this.musicGain);
    d1.start(); d2.start();
    this.drone = [d1, d2];

    const bpm = 168, step = 60 / bpm / 2;
    // E-standard riff (semitones from low E). -1 = rest
    const riff = [0, 0, 0, 1, 0, 0, 3, -1, 0, 0, 0, 1, 0, 0, 6, 5];
    let i = 0;
    let next = ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      while (next < ctx.currentTime + 0.25) {
        const note = riff[i % riff.length];
        if (note >= 0) this.chug(82.41 * Math.pow(2, note / 12), next, step * 0.9);
        if (i % 4 === 0 || (i % 16 === 14)) this.kick(next);
        if (i % 8 === 4) this.snare(next);
        i++;
        next += step;
      }
    }, 60);
  }

  chug(freq, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), o5 = ctx.createOscillator();
    o.type = 'sawtooth'; o5.type = 'sawtooth';
    o.frequency.value = freq; o5.frequency.value = freq * 1.498;
    const ws = ctx.createWaveShaper(); ws.curve = this.distCurve;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(ws); o5.connect(ws); ws.connect(f).connect(g).connect(this.musicGain);
    o.start(t); o5.start(t); o.stop(t + dur + 0.02); o5.stop(t + dur + 0.02);
  }

  kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.2);
  }

  snare(t) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random()); src.stop(t + 0.16);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicEl) this.musicEl.pause();
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.drone) { this.drone.forEach((o) => { try { o.stop(); } catch { /* noop */ } }); this.drone = null; }
    if (this.musicSrc) { try { this.musicSrc.stop(); } catch { /* noop */ } this.musicSrc = null; }
  }

  stopAll() {
    this.stopEngine();
    this.stopMusic();
  }

  suspend() { if (this.ctx) this.ctx.suspend(); if (this.musicEl && this.musicPlaying) this.musicEl.pause(); }
  resume() { if (this.ctx) this.ctx.resume(); if (this.musicEl && this.musicPlaying && !this.trackPaused) this.musicEl.play().catch(() => {}); }
}

/** Single shared instance used by React UI and the engine. */
export const audio = new AudioManager();
