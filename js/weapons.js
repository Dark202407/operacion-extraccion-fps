/* =====================================================================
   WEAPONS — RF01 (dos armas GLB + cambio con 1 y 2 + un disparo por clic)
             RF02 (munición independiente por arma)

   Cada arma se carga desde su archivo .glb y se coloca como hijo de la
   cámara, por lo que siempre acompaña el movimiento y la rotación del
   jugador (vista en primera persona).
   ===================================================================== */

class WeaponSystem {
  constructor(camera, loader) {
    this.camera = camera;
    this.loader = loader;
    this.weapons = [];
    this.current = 0;

    // agrupador de la vista en primera persona
    this.rig = new THREE.Group();
    this.rig.name = 'weaponRig';
    camera.add(this.rig);

    this.time = 0;
    this.cooldown = 0;
    this.switchAnim = 0;      // 0..1 animación de cambio de arma
    this.recoilAnim = 0;
    this.muzzleFlashs = [];
  }

  // ------------------------------------------------------------- carga GLB
  async load(onProgress) {
    let done = 0;
    for (const def of CONFIG.weapons) {
      const gltf = await this.loader.loadAsync(def.model);
      const model = gltf.scene;

      // materiales: el visor del arma se vuelve ligeramente emisivo
      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          if (o.material) {
            o.material.envMapIntensity = 0.6;
            o.material.roughness = Math.min(1, (o.material.roughness || 0.5) + 0.05);
          }
        }
      });

      // normalizar el tamaño y orientar el cañón hacia -Z (frente de cámara)
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3(); box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const k = (def.id === 'pistola' ? 0.30 : 0.55) / Math.max(0.0001, maxDim);

      const holder = new THREE.Group();
      holder.name = def.id;
      holder.rotation.y = Math.PI;          // el cañón del GLB apunta a +Z; la cámara mira a -Z
      holder.scale.setScalar(k);
      model.position.sub(new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.min.y, box.getCenter(new THREE.Vector3()).z));
      holder.add(model);
      holder.visible = false;

      // luz de fogonazo en la boca del arma
      const flash = new THREE.PointLight(0xffc27a, 0, 6, 2);
      flash.position.set(0, -0.02, -0.55);
      holder.add(flash);

      // marca de la boca del cañón para calcular de dónde sale el disparo
      const muzzleNode = model.getObjectByName('boca');

      const w = {
        def, holder, model, flash, muzzleNode,
        mag: def.startMag,
        cooldown: 0,
        bobPhase: Math.random() * 10
      };
      this.rig.add(holder);
      this.weapons.push(w);
      done++; if (onProgress) onProgress(done / CONFIG.weapons.length);
    }
    this.equip(0, true);
  }

  // ------------------------------------------------------------- selección
  equip(index, instant) {
    if (index === this.current && !instant) return;
    const prev = this.weapons[this.current];
    if (prev) prev.holder.visible = false;
    this.current = index;
    const w = this.weapons[index];
    w.holder.visible = true;
    this.switchAnim = instant ? 0 : 1;
    if (!instant) SFX.switchWeapon();
    if (this.onChange) this.onChange(w);
  }

  get active() { return this.weapons[this.current]; }

  // ------------------------------------------------------------- recarga
  // Solo se recupera munición con las cajas del escenario (RF02).
  // El cargador se rellena automáticamente desde la reserva del arma
  // al pulsar R (no crea balas nuevas).
  reloadable() {
    const w = this.active;
    return w.def.reserve > 0 && w.mag < w.def.magSize;
  }

  // ------------------------------------------------------------- disparo
  // Se llama UNA vez por cada clic izquierdo (game.js controla el evento).
  tryShoot() {
    const w = this.active;
    if (!w || w.cooldown > 0) return null;
    if (w.mag <= 0) {
      w.cooldown = 0.25;
      SFX.dryFire();
      if (this.onEmpty) this.onEmpty(w);
      return null;
    }
    w.mag--;                                   // cada disparo consume 1 bala
    w.cooldown = w.def.fireCooldown;
    this.recoilAnim = 1;
    w.flash.intensity = 6;
    if (w.def.id === 'escopeta') SFX.shotgun(); else SFX.pistol();

    // animación de la corredera / bombeo
    const slide = w.model.getObjectByName('corredera');
    if (slide) {
      slide.position.z = -0.045;
      slide.userData.dirty = true;
    }
    if (this.onShot) this.onShot(w);
    return w;
  }

  // ------------------------------------------------------------- por frame
  update(dt, playerSpeed, t) {
    this.time = t;
    for (const w of this.weapons) {
      w.cooldown = Math.max(0, w.cooldown - dt);
      w.flash.intensity = Math.max(0, w.flash.intensity - dt * 55);
      const slide = w.model.getObjectByName('corredera');
      if (slide && slide.userData.dirty) {
        slide.position.z += dt * 0.5;
        if (slide.position.z > -0.001) { slide.position.z = 0; slide.userData.dirty = false; }
      }
    }

    // transición de cambio de arma (baja y sube)
    if (this.switchAnim > 0) this.switchAnim = Math.max(0, this.switchAnim - dt * 3.2);
    if (this.recoilAnim > 0) this.recoilAnim = Math.max(0, this.recoilAnim - dt * 6.5);

    const w = this.active;
    if (!w) return;

    // balanceo (bob) mientras camina + retroceso del disparo
    const move = Math.min(1, playerSpeed / CONFIG.player.speed);
    w.bobPhase += dt * (4 + move * 6);
    const bobX = Math.sin(w.bobPhase) * 0.012 * move;
    const bobY = Math.abs(Math.cos(w.bobPhase)) * 0.010 * move;
    const hold = w.def.hold;
    const lower = this.switchAnim * 0.45;

    w.holder.position.set(
      hold.pos[0] + bobX,
      hold.pos[1] + bobY - lower,
      hold.pos[2] + this.recoilAnim * 0.075
    );
    w.holder.rotation.set(
      hold.rot[0] + this.recoilAnim * 0.18,
      hold.rot[1] + bobX * 0.9,
      hold.rot[2] + this.switchAnim * 0.5
    );
    w.holder.scale.setScalar(hold.scale * (1 + this.recoilAnim * 0.04));
  }
}
