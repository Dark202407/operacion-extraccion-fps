/* =====================================================================
   AUDIO — efectos de sonido sintetizados con la Web Audio API.
   No se usan archivos externos: todo se genera en tiempo de ejecución,
   así el proyecto funciona offline y sin problemas de licencias.
   ===================================================================== */
const SFX = (function () {
  let ctx = null, master = null, enabled = true;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    return ctx;
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    return buf;
  }

  function noise(dur, freq, q, gain, type) {
    if (!enabled || !ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t); src.stop(t + dur);
  }

  function tone(freq, dur, gain, type, slideTo) {
    if (!enabled || !ensure()) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + dur);
  }

  return {
    resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setEnabled(v) { enabled = v; },
    pistol() { noise(0.16, 1500, 0.6, 0.55); tone(180, 0.12, 0.25, 'square', 60); },
    shotgun() { noise(0.34, 700, 0.5, 0.75); tone(95, 0.26, 0.4, 'sawtooth', 40); },
    dryFire() { tone(320, 0.05, 0.12, 'square', 180); },
    reload() { tone(220, 0.07, 0.15, 'square'); setTimeout(() => tone(150, 0.09, 0.13, 'square'), 130); },
    hit() { tone(900, 0.06, 0.12, 'sine', 400); },
    kill() { noise(0.3, 260, 0.8, 0.4); tone(120, 0.3, 0.2, 'sawtooth', 45); },
    hurt() { noise(0.28, 380, 0.7, 0.5); tone(70, 0.3, 0.3, 'sine', 40); },
    pickup() { tone(520, 0.09, 0.2, 'triangle', 780); setTimeout(() => tone(880, 0.12, 0.16, 'triangle', 1180), 80); },
    switchWeapon() { tone(340, 0.05, 0.1, 'square'); },
    growl() { tone(90, 0.5, 0.10, 'sawtooth', 55); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.4, 0.18, 'triangle'), i * 160)); },
    over() { [330, 262, 196, 130].forEach((f, i) => setTimeout(() => tone(f, 0.5, 0.2, 'sawtooth'), i * 200)); }
  };
})();
