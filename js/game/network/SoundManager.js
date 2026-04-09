/**
 * SoundManager — synthesised game sounds via Web Audio API.
 * No audio files needed. All tones generated procedurally.
 */

class SoundManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
  }

  _getCtx() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    return this._ctx;
  }

  /**
   * Play a sequence of tones.
   * @param {Array<{freq: number, dur: number, vol?: number, type?: OscillatorType, delay?: number}>} notes
   */
  async _play(notes) {
    if (!this._enabled) return;
    const ctx = this._getCtx();
    if (!ctx) return;
    // Browser autoplay policy suspends AudioContext until a user gesture.
    // Must await resume() before scheduling — fire-and-forget fails silently.
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { return; }
    }
    const now = ctx.currentTime;
    for (const n of notes) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = n.type || 'sine';
      osc.frequency.setValueAtTime(n.freq, now + (n.delay || 0));
      const vol = n.vol ?? 0.18;
      gain.gain.setValueAtTime(vol, now + (n.delay || 0));
      gain.gain.exponentialRampToValueAtTime(0.001, now + (n.delay || 0) + n.dur);
      osc.start(now + (n.delay || 0));
      osc.stop(now  + (n.delay || 0) + n.dur + 0.02);
    }
  }

  // ── Sound presets ────────────────────────────────────────────────────────

  /** Neutral in-game event (merchant, drought, etc.) */
  event() {
    this._play([
      { freq: 660, dur: 0.12, vol: 0.14 },
      { freq: 880, dur: 0.18, vol: 0.12, delay: 0.10 },
    ]);
  }

  /** Positive / good event (discovery, refugees, truce…) */
  eventGood() {
    this._play([
      { freq: 523, dur: 0.09, vol: 0.15 },
      { freq: 659, dur: 0.09, vol: 0.15, delay: 0.08 },
      { freq: 784, dur: 0.18, vol: 0.13, delay: 0.16 },
    ]);
  }

  /** Danger / bad event (raid, fire, boss…) */
  eventDanger() {
    this._play([
      { freq: 220, dur: 0.22, vol: 0.20, type: 'sawtooth' },
      { freq: 180, dur: 0.28, vol: 0.16, type: 'sawtooth', delay: 0.18 },
    ]);
  }

  /** Village captured — triumphant fanfare */
  villageCaptured() {
    this._play([
      { freq: 392, dur: 0.10, vol: 0.18 },
      { freq: 523, dur: 0.10, vol: 0.18, delay: 0.09 },
      { freq: 659, dur: 0.10, vol: 0.18, delay: 0.18 },
      { freq: 784, dur: 0.28, vol: 0.20, delay: 0.27 },
    ]);
  }

  /** Battle starts */
  battleStart() {
    this._play([
      { freq: 150, dur: 0.25, vol: 0.22, type: 'square' },
      { freq: 200, dur: 0.18, vol: 0.16, type: 'square', delay: 0.22 },
    ]);
  }

  /** Player joined */
  playerJoined() {
    this._play([
      { freq: 440, dur: 0.09, vol: 0.14 },
      { freq: 550, dur: 0.14, vol: 0.14, delay: 0.08 },
    ]);
  }

  /** Player left / warning */
  playerLeft() {
    this._play([
      { freq: 440, dur: 0.12, vol: 0.14 },
      { freq: 330, dur: 0.18, vol: 0.12, delay: 0.10 },
    ]);
  }

  /** Error / forbidden action */
  error() {
    this._play([
      { freq: 180, dur: 0.18, vol: 0.14, type: 'square' },
    ]);
  }
}

export const soundManager = new SoundManager();