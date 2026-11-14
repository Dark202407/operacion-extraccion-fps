/* =====================================================================
   HUD — interfaz: munición (RF02), arma activa (RF01), integridad,
         contador de infectados, avisos y pantallas de victoria/derrota.
   ===================================================================== */
const HUD = (function () {
  const $ = id => document.getElementById(id);
  const el = {};
  let toastTimer = 0;

  function init() {
    ['hud', 'ammo', 'ammo-reserve', 'weapon-name', 'ammo-panel', 'ammo-note', 'health-fill',
     'zombies-count', 'crosshair', 'hit-marker', 'damage-flash', 'pickup-toast',
     'objective-text', 'screen-start', 'screen-win', 'screen-over', 'screen-pause',
     'loading', 'btn-start', 'btn-restart-win', 'btn-restart-over', 'win-stats', 'over-stats',
     'load-status', 'weapon-slots'].forEach(id => el[id] = $(id));
    el.slots = Array.from(document.querySelectorAll('#weapon-slots .slot'));
  }

  function show(id, visible) {
    const n = el[id]; if (!n) return;
    n.classList.toggle('hidden', !visible);
  }

  let lastAmmo = { mag: -1, reserve: -1, idx: -1 };
  function setWeapon(w, index) {
    el['weapon-name'].textContent = w.def.name;
    lastAmmo.idx = index;
    el.slots.forEach((s, i) => s.classList.toggle('active', i === index));
    setAmmo(w.mag, w.def.reserve, index);
  }

  function setAmmo(mag, reserve, index) {
    if (lastAmmo.mag !== mag) {
      el.ammo.textContent = String(mag).padStart(2, '0');
      lastAmmo.mag = mag;
    }
    el['ammo-reserve'].textContent = reserve > 0 ? String(reserve).padStart(2, '0') : '—';
    el['ammo-panel'].classList.toggle('empty', mag <= 0);
    el['ammo-note'].textContent = mag <= 0
      ? 'SIN MUNICIÓN · busca una caja'
      : (reserve > 0 ? 'Recarga: R  ·  reserva ' + reserve : 'Busca cajas de munición');
  }

  function setHealth(h) {
    el['health-fill'].style.width = h + '%';
    el['health-fill'].classList.toggle('low', h <= 35);
  }

  function setZombies(n) { el['zombies-count'].textContent = String(n).padStart(2, '0'); }
  function setObjective(txt) { el['objective-text'].textContent = txt; }

  function hitMarker() {
    el['hit-marker'].classList.remove('show');
    void el['hit-marker'].offsetWidth;
    el['hit-marker'].classList.add('show');
  }

  function damage() {
    el['damage-flash'].style.transition = 'opacity .05s';
    el['damage-flash'].style.opacity = '1';
    setTimeout(() => {
      el['damage-flash'].style.transition = 'opacity .45s ease-out';
      el['damage-flash'].style.opacity = '0';
    }, 70);
  }

  function toast(text) {
    el['pickup-toast'].textContent = text;
    el['pickup-toast'].classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el['pickup-toast'].classList.remove('show'), 1700);
  }

  function stats(list) {
    return list.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
  }

  function loadingDone() { el.loading.classList.add('hidden'); }
  function setLoadingText(t) { el['load-status'].textContent = t; }
  function enableStart(v) { el['btn-start'].disabled = !v; el['btn-start'].textContent = v ? 'INICIAR MISIÓN' : 'CARGANDO…'; }

  return { init, show, setWeapon, setAmmo, setHealth, setZombies, setObjective,
           hitMarker, damage, toast, stats, loadingDone, setLoadingText, enableStart, el };
})();
