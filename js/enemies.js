/* =====================================================================
   ENEMIES — RF04 (zombis con modelos GLB), RF05 (detección y persecución),
             RF07 (2 impactos para morir), RF09 (contacto => Game Over),
             RF10 (objetos coleccionables con efecto).

   Máquina de estados de cada zombi:
     IDLE   -> de pie en su punto de aparición, sin reaccionar.
     ALERT  -> el jugador entró en detectionRange: se gira y gruñe.
     CHASE  -> avanza hacia el jugador (run si fue alertado, walk si no).
     ATTACK -> a distancia de contacto: golpea y puede provocar Game Over.
     DEAD   -> cae al suelo, deja de perseguir y desaparece.
   ===================================================================== */

const STATE = { IDLE: 'IDLE', ALERT: 'ALERT', CHASE: 'CHASE', ATTACK: 'ATTACK', DEAD: 'DEAD' };

class EnemySystem {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.list = [];
    this.time = 0;
    this.baseModel = null;
    this.animations = [];
    this.modules = {
      head: new THREE.SphereGeometry(0.15, 10, 8),
      torso: new THREE.BoxGeometry(0.44, 0.62, 0.26),
      hips: new THREE.BoxGeometry(0.38, 0.20, 0.24),
      arm: new THREE.BoxGeometry(0.12, 0.52, 0.13),
      leg: new THREE.BoxGeometry(0.15, 0.78, 0.16)
    };
    this.mats = {
      skin: new THREE.MeshStandardMaterial({ color: 0x7c8a6a, roughness: 0.95 }),
      shirt: new THREE.MeshStandardMaterial({ color: 0x4a3b30, roughness: 1 }),
      pants: new THREE.MeshStandardMaterial({ color: 0x2f3438, roughness: 1 }),
      blood: new THREE.MeshStandardMaterial({ color: 0x4a0d0a, roughness: 0.8 })
    };
    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  // ---------------------------------------------------------------- carga GLB
  async load(onProgress) {
    const loader = this.player.loader;
    const gltf = await loader.loadAsync(CONFIG.zombies.model);
    this.baseModel = gltf.scene;
    this.animations = gltf.animations || [];
    this.baseModel.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (o.material) {
          // aspecto de infectado: piel verdosa y ropa desaturada
          o.material = o.material.clone();
          if (o.material.color) o.material.color.lerp(new THREE.Color(0x6f7a58), 0.45);
          o.material.roughness = 1.0;
          o.material.metalness = 0.0;
        }
      }
    });
    if (onProgress) onProgress(1);
  }

  // ---------------------------------------------------------------- creación
  spawnAll() {
    for (const zone of this.world.spawnZones) {
      for (let i = 0; i < zone.count; i++) {
        // distribución aleatoria pero separada dentro de la zona
        const x = zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]);
        const z = zone.z[0] + Math.random() * (zone.z[1] - zone.z[0]);
        this.spawn(x, z, { run: zone.run + Math.random() * 0.25 });
      }
    }
  }

  spawn(x, z, opts) {
    opts = opts || {};
    const scale = CONFIG.zombies.scale * (0.94 + Math.random() * 0.12);

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(root);

    // pivote: los GLB exportados vienen centrados en Y; se bajan para que
    // los pies queden sobre el suelo (y = 0).
    const pivot = new THREE.Group();
    pivot.scale.setScalar(scale);
    pivot.position.y = 0;
    root.add(pivot);

    let mixer = null, actions = {}, model;
    if (this.baseModel) {
      model = SkeletonUtils.clone(this.baseModel);
      // el modelo original está en centímetros y con el pivote en las caderas:
      model.rotation.x = 0; model.rotation.z = 0;
      model.scale.setScalar(1);
      pivot.add(model);
      // corregir la altura: pies a y=0
      model.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(model);
      model.position.y -= bb.min.y;

      if (this.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        for (const clip of this.animations) {
          const key = clip.name.toLowerCase();
          actions[key] = mixer.clipAction(clip);
        }
      }
    } else {
      model = this.buildProceduralZombie();
      pivot.add(model);
    }

    const zp = { x: 0, z: 0, w: 0.55, h: 1.75 };
    const e = {
      id: this.list.length,
      root, pivot, model, mixer, actions,
      state: STATE.IDLE,
      hp: CONFIG.zombies.hp,             // 2 puntos de resistencia (RF07)
      runSpeed: CONFIG.zombies.walkSpeed * (1 + (opts.run || 0)),
      alerted: false,
      alertTimer: 0,
      attackTimer: 0,
      phase: Math.random() * Math.PI * 2,
      walkCycle: Math.random() * Math.PI * 2,
      deathTimer: 0,
      alive: true,
      radius: 0.5
    };

    if (mixer) {
      const idle = actions['idle'] || actions['tpose'];
      const walk = actions['walk'] || actions['run'];
      if (idle) { idle.play(); e.idleAction = idle; }
      if (walk) { walk.play(); walk.setEffectiveWeight(0); e.walkAction = walk; }
    } else {
      e.parts = model.userData.parts;
    }

    this.list.push(e);
    return e;
  }

  // --------------------------------------- zombi de respaldo (sin GLB externo)
  buildProceduralZombie() {
    const g = new THREE.Group();
    const mk = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true; return m;
    };
    const torso = mk(this.modules.torso, this.mats.shirt, 0, 1.12, 0);
    const head = mk(this.modules.head, this.mats.skin, 0, 1.56, 0.02);
    const hips = mk(this.modules.hips, this.mats.pants, 0, 0.79, 0);
    const armL = mk(this.modules.arm, this.mats.skin, -0.28, 1.12, 0.12);
    const armR = mk(this.modules.arm, this.mats.skin, 0.28, 1.12, 0.12);
    const legL = mk(this.modules.leg, this.mats.pants, -0.11, 0.39, 0);
    const legR = mk(this.modules.leg, this.mats.pants, 0.11, 0.39, 0);
    armL.rotation.x = armR.rotation.x = -1.2; // brazos extendidos
    g.add(torso, head, hips, armL, armR, legL, legR);
    g.userData.parts = { torso, head, hips, armL, armR, legL, legR };
    return g;
  }

  // ---------------------------------------------------------------- consultas
  get alive() { return this.list.filter(e => e.alive); }
  get remaining() { return this.list.filter(e => e.alive).length; }

  // ---------------------------------------------------------------- daño
  // RF07: cada impacto válido resta 1 punto; muere exactamente al 2º.
  damage(e, amount) {
    if (!e || !e.alive) return false;
    e.hp -= amount;
    // marca de impacto
    const mark = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), this.mats.blood);
    mark.position.copy(this._tmpA.copy(this.player.camera.position).sub(e.root.position).normalize().multiplyScalar(0.22));
    mark.position.y = 1.15;
    e.root.add(mark);
    if (e.hp <= 0) this.kill(e);
    else {
      // al recibir un disparo también se alerta (si estaba dormido)
      if (e.state === STATE.IDLE) this.alert(e);
    }
    return true;
  }

  alert(e) {
    if (!e.alive || e.alerted) return;
    e.alerted = true;
    e.state = STATE.ALERT;
    e.alertTimer = 0.35;
    if (!e.isNear) SFX.growl();
    if (this.onAlert) this.onAlert(e);
  }

  kill(e) {
    e.alive = false;
    e.state = STATE.DEAD;
    e.deathTimer = 0;
    e.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    SFX.kill();
    if (this.onKill) this.onKill(e);
  }

  // ---------------------------------------------------------------- update
  update(dt, t) {
    this.time = t;
    const p = this.player.position;
    for (const e of this.list) {
      if (e.mixer) e.mixer.update(dt);

      if (e.state === STATE.DEAD) {
        e.deathTimer += dt;
        // caer hacia adelante y hundirse
        e.root.rotation.x = Math.min(Math.PI / 2, e.root.rotation.x + dt * 4.2);
        if (e.deathTimer > 4.5) {
          e.root.position.y -= dt * 0.7;
          if (e.deathTimer > 7) e.root.visible = false;
        }
        continue;
      }

      const dx = p.x - e.root.position.x;
      const dz = p.z - e.root.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      e.isNear = dist < 14;
      e.distance = dist;

      // ---- RF05: activación por proximidad (cada zombi evalúa su distancia)
      if (e.state === STATE.IDLE) {
        if (dist <= CONFIG.zombies.detectionRange) this.alert(e);
        else { this.animate(e, dt, 0); continue; }
      }

      if (e.state === STATE.ALERT) {
        e.alertTimer -= dt;
        // girarse hacia el jugador
        this.face(e, dx, dz, dt, 8);
        if (e.alertTimer <= 0) e.state = STATE.CHASE;
        this.animate(e, dt, 0);
        continue;
      }

      if (e.state === STATE.CHASE || e.state === STATE.ATTACK) {
        // si el jugador escapa muy lejos, el zombi pierde el rastro
        if (dist > CONFIG.zombies.loseRange) {
          e.state = STATE.IDLE; e.alerted = false;
          this.animate(e, dt, 0);
          continue;
        }
        this.face(e, dx, dz, dt, 5);

        if (dist > CONFIG.zombies.attackRange) {
          e.state = STATE.CHASE;
          const speed = e.runSpeed * (this.game && this.game.zombieSpeedFactor ? this.game.zombieSpeedFactor : 1);
          const step = Math.min(speed * dt, Math.max(0, dist - CONFIG.zombies.attackRange));
          let nx = e.root.position.x + (dx / dist) * step;
          let nz = e.root.position.z + (dz / dist) * step;
          // separación suave entre zombis para evitar amontonamiento
          for (const o of this.list) {
            if (o === e || !o.alive) continue;
            const ox = nx - o.root.position.x, oz = nz - o.root.position.z;
            const od = Math.sqrt(ox * ox + oz * oz);
            if (od < 0.95 && od > 0.0001) { nx += (ox / od) * (0.95 - od) * 0.5; nz += (oz / od) * (0.95 - od) * 0.5; }
          }
          // el zombi también respeta las paredes del escenario
          const res = this.worldResolve(nx, nz);
          e.root.position.x = res.x; e.root.position.z = res.z;
          this.animate(e, dt, 1);
        } else {
          // ---- RF09: contacto con el jugador
          e.state = STATE.ATTACK;
          e.attackTimer -= dt;
          this.animate(e, dt, 0.15);
          if (e.attackTimer <= 0) {
            e.attackTimer = CONFIG.zombies.attackCooldown;
            if (this.onAttack) this.onAttack(e);
          }
        }
      }
    }
  }

  worldResolve(x, z) {
    const r = 0.45;
    for (const c of this.world.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        // empujar hacia afuera por el eje de menor penetración
        const px = Math.min(Math.abs(x + r - c.minX), Math.abs(c.maxX - (x - r)));
        const pz = Math.min(Math.abs(z + r - c.minZ), Math.abs(c.maxZ - (z - r)));
        if (px < pz) x = (x < (c.minX + c.maxX) / 2) ? c.minX - r : c.maxX + r;
        else z = (z < (c.minZ + c.maxZ) / 2) ? c.minZ - r : c.maxZ + r;
      }
    }
    return { x, z };
  }

  face(e, dx, dz, dt, speed) {
    const target = Math.atan2(dx, dz);
    let d = target - e.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    e.root.rotation.y += d * Math.min(1, dt * speed);
  }

  // Mezcla entre animación de reposo y de caminata + balanceo del andar.
  animate(e, dt, walkAmount) {
    if (e.idleAction || e.walkAction) {
      if (e.idleAction) e.idleAction.setEffectiveWeight(1 - walkAmount);
      if (e.walkAction) {
        e.walkAction.setEffectiveWeight(walkAmount);
        e.walkAction.timeScale = 0.85 + (e.runSpeed - CONFIG.zombies.walkSpeed) * 0.8;
      }
    } else if (e.parts) {
      // respaldo: animación procedural de brazos y piernas
      e.walkCycle += dt * (walkAmount > 0.5 ? 6 : 1.2);
      const s = Math.sin(e.walkCycle) * 0.55 * walkAmount;
      e.parts.legL.rotation.x = s;
      e.parts.legR.rotation.x = -s;
      e.parts.armL.rotation.x = -1.2 + s * 0.35;
      e.parts.armR.rotation.x = -1.2 - s * 0.35;
    }
    // balanceo del cuerpo (más marcado al correr)
    e.pivot.rotation.z = Math.sin(this.time * 3 + e.phase) * 0.045 * (0.4 + walkAmount);
    e.pivot.position.y = Math.abs(Math.sin(e.walkCycle * 0.5)) * 0.05 * walkAmount;
  }
}

/* =====================================================================
   PICKUPS — RF10: cajas de munición, botiquines y potenciadores.
   ===================================================================== */
class PickupSystem {
  constructor(scene, world, player, weapons) {
    this.scene = scene; this.world = world; this.player = player; this.weapons = weapons;
    this.items = [];
    this.time = 0;
    this.build();
  }

  build() {
    const crateGeo = new THREE.BoxGeometry(0.62, 0.44, 0.44);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x4b5a35, roughness: 0.85, metalness: 0.2 });
    const crateTex = makeTexture(128, (c, s) => {
      c.fillStyle = '#556b3a'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#2b3620'; c.lineWidth = 6; c.strokeRect(6, 6, s - 12, s - 12);
      c.fillStyle = '#e8d9a8'; c.font = 'bold 58px Consolas,monospace'; c.textAlign = 'center';
      c.fillText('AMMO', s / 2, s / 2 + 20);
      c.font = 'bold 22px Consolas,monospace'; c.fillText('7.62', s / 2, s - 16);
    });
    crateMat.map = crateTex;

    const medGeo = new THREE.BoxGeometry(0.46, 0.36, 0.3);
    const medMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.6 });

    const speedGeo = new THREE.IcosahedronGeometry(0.24, 0);
    const speedMat = new THREE.MeshStandardMaterial({ color: 0x39d8ff, emissive: 0x1a7f9e, emissiveIntensity: 1.6, roughness: 0.3 });

    for (const spot of this.world.pickupSpots) {
      const g = new THREE.Group();
      g.position.copy(spot.position);
      let mesh, lightColor = 0xffc060;
      if (spot.type === 'ammo') mesh = new THREE.Mesh(crateGeo, crateMat);
      else if (spot.type === 'medkit') {
        mesh = new THREE.Group();
        const box = new THREE.Mesh(medGeo, medMat);
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xd0352c, emissive: 0x501010, emissiveIntensity: 0.8 });
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.02), crossMat); c1.position.z = 0.16;
        const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.02), crossMat); c2.position.z = 0.16;
        mesh.add(box, c1, c2); lightColor = 0xff6a5a;
      } else {
        mesh = new THREE.Mesh(speedGeo, speedMat); lightColor = 0x39d8ff;
      }
      mesh.castShadow = true;
      mesh.position.y = spot.type === 'speed' ? 0.75 : 0.32;
      g.add(mesh);

      // halo en el suelo para que el objeto sea visible de lejos
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24),
        new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);

      const light = new THREE.PointLight(lightColor, 3.5, 5.5, 2);
      light.position.y = 0.9; g.add(light);

      this.scene.add(g);
      this.items.push({ type: spot.type, group: g, mesh, ring, base: mesh.position.y, taken: false });
    }
  }

  update(dt, t, onPickup) {
    this.time = t;
    const p = this.player.position;
    for (const it of this.items) {
      if (it.taken) continue;
      it.mesh.rotation.y += dt * 0.9;
      it.mesh.position.y = it.base + Math.sin(t * 2 + it.base * 3) * 0.06;
      it.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
      const dx = p.x - it.group.position.x, dz = p.z - it.group.position.z;
      if (dx * dx + dz * dz < 1.5 * 1.5) {
        it.taken = true;
        it.group.visible = false;
        onPickup(it.type);
      }
    }
  }

  reset() {
    for (const it of this.items) { it.taken = false; it.group.visible = true; }
  }
}
