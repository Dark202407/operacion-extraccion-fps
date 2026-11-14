/* =====================================================================
   PLAYER — RF06: cámara en primera persona con Pointer Lock,
                   desplazamiento WASD y colisiones contra el escenario.
   ===================================================================== */

class Player {
  constructor(camera, world, loader) {
    this.camera = camera;
    this.world = world;
    this.loader = loader;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;         // rotación horizontal (mouse X)
    this.pitch = 0;       // inclinación vertical (mouse Y)
    this.bob = 0;
    this.health = CONFIG.player.maxHealth;
    this.invuln = 0;
    this.speedFactor = 1;
    this.boostTime = 0;
    this.velocityXZ = 0;
  }

  reset() {
    this.position.copy(this.world.startPosition);
    this.velocity.set(0, 0, 0);
    this.yaw = this.world.startYaw;
    this.pitch = 0;
    this.health = CONFIG.player.maxHealth;
    this.invuln = 0;
    this.speedFactor = 1;
    this.boostTime = 0;
    this.syncCamera(0);
  }

  // RF06: el mouse orienta la cámara (yaw/pitch con límite vertical)
  look(dx, dy) {
    this.yaw -= dx * CONFIG.player.mouseSensitivity;
    this.pitch -= dy * CONFIG.player.mouseSensitivity;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  // ------------------------------------------------------- movimiento WASD
  update(dt, keys, enabled) {
    // boost temporal (RF10)
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      if (this.boostTime <= 0) { this.boostTime = 0; this.speedFactor = 1; }
    }
    if (this.invuln > 0) this.invuln -= dt;

    let fw = 0, side = 0;
    if (enabled) {
      if (keys['KeyW'] || keys['ArrowUp']) fw += 1;
      if (keys['KeyS'] || keys['ArrowDown']) fw -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) side += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) side -= 1;
    }

    // dirección relativa al yaw de la cámara
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let dirX = (-sin * fw) + (cos * side);
    let dirZ = (-cos * fw) + (-sin * side);
    const len = Math.hypot(dirX, dirZ);
    if (len > 0) { dirX /= len; dirZ /= len; }

    const sprint = (keys['ShiftLeft'] || keys['ShiftRight']) ? CONFIG.player.sprint / CONFIG.player.speed : 1;
    const speed = CONFIG.player.speed * this.speedFactor * sprint;
    const targetX = dirX * speed, targetZ = dirZ * speed;

    // suavizado de la aceleración
    const k = Math.min(1, dt * (len > 0 ? 12 : 16));
    this.velocity.x += (targetX - this.velocity.x) * k;
    this.velocity.z += (targetZ - this.velocity.z) * k;

    const nx = this.position.x + this.velocity.x * dt;
    const nz = this.position.z + this.velocity.z * dt;
    const res = this.resolve(nx, nz);
    // si el choque bloquea un eje, anular esa componente de velocidad
    if (Math.abs(res.x - nx) > 1e-6) this.velocity.x *= 0.2;
    if (Math.abs(res.z - nz) > 1e-6) this.velocity.z *= 0.2;
    this.position.x = res.x;
    this.position.z = res.z;

    this.velocityXZ = Math.hypot(this.velocity.x, this.velocity.z);
    this.bob += dt * this.velocityXZ * 1.9;
    this.syncCamera(dt);
  }

  // colisión círculo (jugador) contra cajas (escenario)
  resolve(x, z) {
    const r = CONFIG.player.radius;
    for (const c of this.world.colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        const px = Math.min(Math.abs(x + r - c.minX), Math.abs(c.maxX - (x - r)));
        const pz = Math.min(Math.abs(z + r - c.minZ), Math.abs(c.maxZ - (z - r)));
        if (px < pz) x = (x < (c.minX + c.maxX) / 2) ? c.minX - r : c.maxX + r;
        else z = (z < (c.minZ + c.maxZ) / 2) ? c.minZ - r : c.maxZ + r;
      }
    }
    return { x, z };
  }

  syncCamera(dt) {
    const bobAmp = CONFIG.player.eyeHeightBob * Math.min(1, this.velocityXZ / CONFIG.player.speed);
    const y = CONFIG.player.height + Math.sin(this.bob * 2) * bobAmp;
    this.camera.position.set(this.position.x, y, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    // leve inclinación lateral al desplazarse de costado
    this.camera.rotation.z = -this.velocity.x * 0.004 * Math.cos(this.yaw) + this.velocity.z * 0.004 * Math.sin(this.yaw);
  }

  hurt(amount) {
    if (this.invuln > 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = CONFIG.player.invulnerable;
    return true;
  }

  heal(amount) {
    this.health = Math.min(CONFIG.player.maxHealth, this.health + amount);
  }
}
