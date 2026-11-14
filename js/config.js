/* =====================================================================
   CONFIG — todos los valores ajustables del juego en un solo lugar.
   RF02: munición inicial y recuperada por caja.
   RF05: distancia de activación de los zombis.
   ===================================================================== */
const CONFIG = {
  // ------------------------------- jugador
  player: {
    height: 1.70,            // altura de la cámara (ojos)
    radius: 0.42,            // radio de colisión con paredes
    speed: 5.2,              // m/s al caminar
    sprint: 8.0,             // m/s con Shift (potenciador incluido)
    accel: 22,               // suavizado del desplazamiento
    mouseSensitivity: 0.0023,
    maxHealth: 100,
    damagePerHit: 28,        // daño de cada embestida de un zombi
    invulnerable: 1.0,       // segundos de invulnerabilidad tras recibir daño
    eyeHeightBob: 0.045      // balanceo de la cámara al caminar
  },

  // ------------------------------- armas (RF01 / RF02)
  weapons: [
    {
      id: 'pistola', name: 'PISTOLA', model: 'models/pistola.glb',
      magSize: 12,            // balas por cargador
      startMag: 12,
      damage: 1,              // 1 impacto válido = -1 de resistencia (RF07)
      range: 60,
      fireCooldown: 0.22,     // segundos entre disparos (1 clic = 1 bala)
      recoil: 0.010,
      spread: 0.004,
      hold: { pos: [0.20, -0.19, -0.36], rot: [0, 0, 0], scale: 1.0 }
    },
    {
      id: 'escopeta', name: 'ESCOPETA', model: 'models/escopeta.glb',
      magSize: 6,
      startMag: 6,
      damage: 1,
      range: 45,
      fireCooldown: 0.72,
      recoil: 0.032,
      spread: 0.003,
      hold: { pos: [0.22, -0.22, -0.42], rot: [0, -0.03, 0], scale: 0.95 }
    }
  ],

  // ------------------------------- munición de reserva (RF02)
  ammo: {
    startingReserve: 18,      // balas extra al empezar la misión
    boxPistol: 24,            // +24 balas para la pistola por caja
    boxShotgun: 12,           // +12 cartuchos de escopeta por caja
    boxRespawn: 0             // 0 = las cajas no reaparecen
  },

  // ------------------------------- coleccionables (RF10)
  pickups: {
    speedBoostDuration: 9,    // segundos de velocidad x1.5
    speedBoostFactor: 1.5,
    medkitHeal: 30
  },

  // ------------------------------- zombis (RF04 / RF05 / RF07)
  zombies: {
    hp: 2,                    // dos puntos de resistencia
    detectionRange: 13,       // radio de activación (configurable)
    loseRange: 22,            // deja de perseguir/atacar si te alejas
    walkSpeed: 1.45,
    runSpeed: 2.85,
    attackRange: 1.35,
    attackCooldown: 1.15,
    scale: 0.92,              // altura final ~1.7 m
    model: 'models/zombi.gltf'
  },

  // ------------------------------- nivel (RF03 / RF08)
  level: {
    zoneCount: 3,             // zonas de generación con dificultad creciente
    exitPosition: [8, 0, 150],
    exitRadius: 4.2
  },

  // ------------------------------- depuración
  debug: { invulnerable: false, showColliders: false }
};

// se permite sobreescribir valores desde la consola: CONFIG.zombies.detectionRange = 20
window.CONFIG = CONFIG;
