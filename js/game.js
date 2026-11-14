/* =====================================================================
   GAME — bucle principal e integración de todas las mecánicas.
     RF01 armas (1/2, un disparo por clic)
     RF02 munición y cajas de abastecimiento
     RF03 escenario explorable
     RF04/RF05 zombis GLB con detección y persecución
     RF06 cámara FPS + WASD + Pointer Lock
     RF07 raycasting: 2 impactos para eliminar a un zombi
     RF08 progresión por tres etapas + zona de extracción
     RF09 Game Over al ser alcanzado
     RF10 coleccionables
     RF11 dificultad progresiva
     RF12 ?demo=1 activa la demostración automática
   ===================================================================== */

class Game {
  constructor() {
    this.state = 'loading';      // loading | ready | playing | paused | over | win
    this.time = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, picked: 0, startedAt: 0, duration: 0 };
    this.keys = {};
    this.pointerLocked = false;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 70;
    this.mouseDown = false;
    this.lastClickAt = 0;
  }

  // ------------------------------------------------------------- inicialización
  async init() {
    HUD.init();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0d1016, 0.019);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    // niebla volumétrica simple: partículas de polvo flotando
    this.buildDust();
    buildWorld(this.scene);   // ?mundo=1 genera solo el escenario (pruebas)

    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);

    // ------------------------------------------------ mundo
    this.world = buildWorld(this.scene);

    // ------------------------------------------------ cargadores
    if (typeof THREE.GLTFLoader === 'undefined') {
      HUD.setLoadingText('Error: no se pudo cargar GLTFLoader');
      return;
    }
    this.loader = new THREE.GLTFLoader();
    const manager = new THREE.LoadingManager();
    manager.onError = (url) => console.warn('No se pudo cargar el recurso:', url);

    this.player = new Player(this.camera, this.world, this.loader);
    this.weapons = new WeaponSystem(this.camera, this.loader);
    this.enemies = new EnemySystem(this.scene, this.world, this.player);
    this.enemies.game = this;

    HUD.setLoadingText('Cargando armas GLB…');
    await this.weapons.load();
    HUD.setLoadingText('Cargando zombis GLB…');
    await this.enemies.load();

    this.pickups = new PickupSystem(this.scene, this.world, this.player, this.weapons);
    this.tracers = [];

    // ------------------------------------------------ lógica de eventos
    this.weapons.onChange = (w) => {
      HUD.setWeapon(w, this.weapons.current);
    };
    this.weapons.onShot = (w) => this.shoot(w);
    this.weapons.onEmpty = () => HUD.toast('SIN MUNICIÓN · BUSCA UNA CAJA');

    this.enemies.onKill = (e) => {
      this.stats.kills++;
      HUD.setZombies(this.enemies.remaining);
    };
    this.enemies.onAttack = (e) => this.enemyAttack(e);
    this.enemies.onAlert = (e) => { /* se podría reproducir sonido por distancia */ };

    this.bindInput();

    // partículas ambientales
    HUD.loadingDone();
    HUD.show('hud', false);
    HUD.show('crosshair', false);
    HUD.enableStart(true);
    HUD.setLoadingText('Modelos cargados · listo para jugar');

    this.state = 'ready';
    this.clock = new THREE.Clock();
    this.animate();

    // modo demostración automática (para capturas/video): game.html?demo=1
    const demoParam = new URLSearchParams(location.search).get('demo');
    if (demoParam) this.autoDemo = demoParam === '1' || demoParam === 'true';
    window.GAME = this;
  }

  buildDust() {
    const count = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = -8 + Math.random() * 175;
      // NaN guard: coordenadas válidas siempre
      if (!isFinite(pos[i * 3 + 1])) pos[i * 3 + 1] = 1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustMat = new THREE.PointsMaterial({ color: 0xffd8a8, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.scene.add(this.dust);
  }

  // ------------------------------------------------------------- entrada
  bindInput() {
    const canvas = this.renderer.domElement;

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Digit1') { this.selectWeapon(0); e.preventDefault(); }
      if (e.code === 'Digit2') { this.selectWeapon(1); e.preventDefault(); }
      if (e.code === 'KeyR') this.reloadAuto();
      if (e.code === 'KeyP' && this.state === 'playing') this.pause();
      // evitar el scroll con WASD/espacio
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // RF01: un solo disparo por clic izquierdo. La acción se ejecuta al
    // presionar (mousedown) y nunca se repite mientras el botón sigue
    // presionado, por lo que no existe disparo automático.
    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.state !== 'playing') return;
      if (!this.pointerLocked && !this.autoDemo) {
        this.requestLock();
        return;
      }
      this.fireOnce();
    });
    // se registra pero NO dispara: evita el disparo automático por mantener pulsado
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // RF06: el movimiento del mouse orienta la cámara
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || this.state !== 'playing') return;
      this.player.look(e.movementX || 0, e.movementY || 0);
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      if (!this.pointerLocked && this.state === 'playing' && !this.autoDemo) this.pause();
      if (this.pointerLocked && this.state === 'paused') this.resume();
    });

    HUD.el['btn-start'].addEventListener('click', () => this.start());
    HUD.el['btn-restart-win'].addEventListener('click', () => this.restart());
    HUD.el['btn-restart-over'].addEventListener('click', () => this.restart());
    HUD.el['screen-pause'].addEventListener('click', () => { if (this.state === 'paused') this.requestLock(); });

    canvas.addEventListener('click', () => {
      if (this.state === 'ready' || this.state === 'paused') this.requestLock();
    });
  }

  requestLock() {
    if (this.autoDemo) return;
    const el = this.renderer.domElement;
    if (el.requestPointerLock) el.requestPointerLock();
  }

  selectWeapon(index) {
    if (this.state !== 'playing') return;
    this.weapons.equip(index);
    HUD.setWeapon(this.weapons.active, index);
  }

  // Rellena el cargador desde la reserva (no crea munición nueva)
  reloadAuto() {
    if (this.state !== 'playing') return;
    const w = this.weapons.active;
    if (!w || w.def.reserve <= 0 || w.mag >= w.def.magSize) return;
    const need = w.def.magSize - w.mag;
    const take = Math.min(need, w.def.reserve);
    w.mag += take;
    w.def.reserve -= take;
    SFX.reload();
    HUD.setAmmo(w.mag, w.def.reserve, this.weapons.current);
    HUD.toast('RECARGA · ' + w.def.name);
  }

  // ------------------------------------------------------------- disparo
  fireOnce() {
    const now = performance.now();
    if (now - this.lastClickAt < 30) return;   // protección extra anti-doble-evento
    this.lastClickAt = now;

    const w = this.weapons.tryShoot();
    if (!w) return;
    this.stats.shots++;
    HUD.setAmmo(w.mag, w.def.reserve, this.weapons.current);
  }

  // RF07: raycasting desde el centro de la pantalla
  shoot(w) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.getWorldPosition(new THREE.Vector3()), dir.clone().normalize());
    this.raycaster.far = w.def.range;

    const targets = this.enemies.list.filter(e => e.alive).map(e => e.root);
    const hits = this.raycaster.intersectObjects(targets, true);

    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    let end = origin.clone().add(dir.clone().multiplyScalar(w.def.range));

    if (hits.length) {
      const hit = hits[0];
      // subir por la jerarquía hasta el zombi propietario
      let node = hit.object, owner = null;
      while (node && !owner) {
        owner = this.enemies.list.find(e => e.root === node);
        node = node.parent;
      }
      end = hit.point.clone();
      if (owner) {
        // Un impacto válido = 1 punto menos de resistencia
        this.enemies.damage(owner, w.def.damage);
        this.stats.hits++;
        HUD.hitMarker();
        SFX.hit();
        this.spawnBlood(hit.point);
      }
    }
    this.spawnTracer(origin, end);
  }

  spawnTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.06 });
  }

  spawnBlood(p) {
    const count = 14;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.4, (Math.random() - 0.5) * 3));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9c1b12, size: 0.07 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.tracers.push({ line: pts, life: 0.55, vel });
  }

  // ------------------------------------------------------------- daño
  enemyAttack(e) {
    if (this.state !== 'playing') return;
    if (CONFIG.debug.invulnerable) return;
    if (!this.player.hurt(CONFIG.player.damagePerHit)) return;
    HUD.damage();
    HUD.setHealth(this.player.health);
    SFX.hurt();
    if (this.player.health <= 0) this.gameOver();
  }

  // ------------------------------------------------------------- coleccionables
  onPickup(type) {
    this.stats.picked++;
    if (type === 'ammo') {
      const p = this.weapons.weapons[0], s = this.weapons.weapons[1];
      p.def.reserve += CONFIG.ammo.boxPistol;
      s.def.reserve += CONFIG.ammo.boxShotgun;
      HUD.setAmmo(this.weapons.active.mag, this.weapons.active.def.reserve, this.weapons.current);
      HUD.toast(`MUNICIÓN  +${CONFIG.ammo.boxPistol} PISTOLA  /  +${CONFIG.ammo.boxShotgun} ESCOPETA`);
      if (this.weapons.active.mag === 0) this.reloadAuto();
    } else if (type === 'medkit') {
      this.player.heal(CONFIG.pickups.medkitHeal);
      HUD.setHealth(this.player.health);
      HUD.toast('BOTIQUÍN  +' + CONFIG.pickups.medkitHeal + ' INTEGRIDAD');
    } else if (type === 'speed') {
      this.player.speedFactor = CONFIG.pickups.speedBoostFactor;
      this.player.boostTime = CONFIG.pickups.speedBoostDuration;
      HUD.toast('IMPULSO  VELOCIDAD x' + CONFIG.pickups.speedBoostFactor);
    }
    SFX.pickup();
  }

  // ------------------------------------------------------------- estados
  start() {
    if (this.state !== 'ready' && this.state !== 'paused') return;
    SFX.resume();
    this.resetSession();
    HUD.show('screen-start', false);
    HUD.show('screen-win', false);
    HUD.show('screen-over', false);
    HUD.show('screen-pause', false);
    HUD.show('hud', true);
    HUD.show('crosshair', true);
    this.state = 'playing';
    this.stats.startedAt = performance.now();
    HUD.setObjective('Alcanza la zona de extracción al norte');
    this.requestLock();
  }

  resetSession() {
    this.player.reset();
    // armas y municiones al estado inicial (RF02)
    CONFIG.weapons.forEach((def, i) => {
      def.reserve = CONFIG.ammo.startingReserve;
      const w = this.weapons.weapons[i];
      w.mag = def.startMag;
      w.cooldown = 0;
    });
    this.weapons.equip(0, true);
    HUD.setWeapon(this.weapons.active, 0);
    HUD.setHealth(this.player.health);

    // zombis
    for (const e of this.enemies.list) this.scene.remove(e.root);
    this.enemies.list = [];
    this.enemies.spawnAll();
    HUD.setZombies(this.enemies.remaining);

    this.pickups.reset();
    for (const t of this.tracers) this.scene.remove(t.line);
    this.tracers = [];
    this.stats = { kills: 0, shots: 0, hits: 0, picked: 0, startedAt: performance.now(), duration: 0 };
    this.zombieSpeedFactor = 1;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    HUD.show('screen-pause', true);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    HUD.show('screen-pause', false);
  }

  restart() {
    HUD.show('screen-win', false);
    HUD.show('screen-over', false);
    this.state = 'ready';
    this.resetSession();
    this.state = 'playing';
    HUD.show('hud', true);
    HUD.show('crosshair', true);
    HUD.setObjective('Alcanza la zona de extracción al norte');
    this.requestLock();
  }

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.closingStats();
    HUD.show('crosshair', false);
    HUD.show('over-stats', true);
    HUD.el['over-stats'].innerHTML = HUD.stats([
      ['Infectados eliminados', this.stats.kills],
      ['Disparos realizados', this.stats.shots],
      ['Objetos recogidos', this.stats.picked],
      ['Distancia recorrida', Math.round(this.player.position.z - this.world.startPosition.z) + ' m']
    ]);
    HUD.show('screen-over', true);
    if (document.exitPointerLock) document.exitPointerLock();
    this.pointerLocked = false;
    SFX.over();
  }

  win() {
    if (this.state !== 'playing') return;
    this.state = 'win';
    this.closingStats();
    HUD.show('crosshair', false);
    HUD.el['win-stats'].innerHTML = HUD.stats([
      ['Tiempo de misión', this.fmt(this.stats.duration)],
      ['Infectados eliminados', this.stats.kills + ' / ' + this.enemies.list.length],
      ['Precisión', this.stats.shots ? Math.round(100 * this.stats.hits / this.stats.shots) + ' %' : '—'],
      ['Objetos recogidos', this.stats.picked]
    ]);
    HUD.show('screen-win', true);
    if (document.exitPointerLock) document.exitPointerLock();
    this.pointerLocked = false;
    SFX.win();
  }

  closingStats() {
    this.stats.duration = (performance.now() - this.stats.startedAt) / 1000;
  }

  fmt(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ------------------------------------------------------------- bucle
  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const rawDt = this.clock.getDelta();
    const dt = Math.min(0.05, rawDt);

    if (this.state === 'playing' || this.state === 'ready') {
      this.time += dt;

      if (this.state === 'playing') {
        this.player.update(dt, this.keys, true);

        // potenciador activo: el escenario "late" ligeramente
        this.dustMaterialUpdate();

        this.enemies.update(dt, this.time);
        this.pickups.update(dt, this.time, (t) => this.onPickup(t));
        this.weapons.update(dt, this.player.velocityXZ, this.time);
        this.updateTracers(dt);

        // progresión: estado de la misión (RF08)
        this.updateObjective();

        // zona de extracción
        const ex = this.world.exit;
        const d = Math.hypot(this.player.position.x - ex.center.x, this.player.position.z - ex.center.z);
        ex.mesh.material.opacity = 0.08 + Math.sin(this.time * 2) * 0.03 + (d < 20 ? 0.06 : 0);
        if (d < ex.radius) this.win();
      } else {
        // en la pantalla de inicio la cámara hace un paneo lento del escenario
        this.camera.position.set(Math.sin(this.time * 0.12) * 3, 1.85, 14 + Math.cos(this.time * 0.1) * 1.5);
        this.camera.rotation.y = Math.PI + Math.sin(this.time * 0.12) * 0.22;
        this.camera.rotation.x = -0.03;
        this.weapons.rig.visible = false;
      }
    }
    if (this.state === 'playing') this.weapons.rig.visible = true;

    // polvo flotante
    if (this.dust) {
      this.dust.position.z = ((this.time * 0.35) % 4) - 2;
      this.dustMat.opacity = 0.35 + Math.sin(this.time) * 0.08;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dustMaterialUpdate() { /* reservado: efectos de pantalla */ }

  updateObjective() {
    const z = this.player.position.z;
    const left = this.enemies.remaining;
    let txt;
    if (z < 40) txt = 'Atraviesa la calle principal · ' + left + ' infectados en el sector';
    else if (z < 96) txt = 'Calle principal · alcanza el callejón';
    else if (z < 122) txt = 'Callejón infestado · abre paso';
    else if (z < 146) txt = 'Mercado · la extracción está al norte';
    else txt = '¡Zona de extracción a ' + Math.round(150 - z) + ' m!';
    HUD.setObjective(txt);

    // dificultad: los zombis aceleran conforme avanzas (RF11)
    this.zombieSpeedFactor = 1 + Math.min(0.35, Math.max(0, (z - 40) / 300));
  }

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.vel) {
        const pos = t.line.geometry.attributes.position;
        for (let k = 0; k < t.vel.length; k++) {
          t.vel[k].y -= 9.8 * dt;
          pos.array[k * 3] += t.vel[k].x * dt;
          pos.array[k * 3 + 1] += t.vel[k].y * dt;
          pos.array[k * 3 + 2] += t.vel[k].z * dt;
        }
        pos.needsUpdate = true;
      } else {
        t.line.material.opacity = Math.max(0, t.life / 0.06) * 0.85;
      }
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        if (t.line.material) t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------- demo automática
  // Reproduce un recorrido por el nivel sin intervención: útil para grabar el
  // video y para las capturas de la memoria.
  startDemo() {
    this.start();
    this.autoDemo = true;
    this.pointerLocked = true;
  }
}

// ---------------------------------------------------------------- arranque
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init().catch(err => {
    console.error(err);
    HUD.setLoadingText('Error al iniciar: ' + err.message);
  });
  // atajos de prueba manual
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') CONFIG.debug.invulnerable = !CONFIG.debug.invulnerable;
  });
});

// ---------------------------------------------------------------- informe de errores visible
// Si algo falla al cargar un recurso, se muestra en pantalla y en consola
// para que el estudiante pueda diagnosticarlo rápido.
window.addEventListener('error', (e) => {
  console.error('[error]', e.message, e.filename + ':' + e.lineno);
});
