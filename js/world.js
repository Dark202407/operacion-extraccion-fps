/* =====================================================================
   WORLD — construcción del escenario 3D (RF03), colisiones del mundo y
   objetos coleccionables (RF10).

   Recorrido:  BASE (inicio) -> CALLE PRINCIPAL -> CALLEJÓN -> MERCADO
               -> PATIO, con una ZONA DE EXTRACCIÓN al final.
   El mundo mide 24 x 168 m: obliga a desplazarse y a enfrentarse a los
   zombis que se interponen en el camino.
   ===================================================================== */

// ------------------------------------------------------------------ texturas
// Todas las texturas se generan con canvas: el juego funciona incluso con file://
function makeTexture(size, painter, repeatX, repeatY) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  painter(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX || 1, repeatY || 1);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noiseOverlay(ctx, size, amount, alpha) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
    if (alpha) d[i + 3] = Math.min(255, d[i + 3] * alpha + 40);
  }
  ctx.putImageData(img, 0, 0);
}

const TEX = {
  asphalt: () => makeTexture(512, (c, s) => {
    c.fillStyle = '#26272a'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(${120 + Math.random() * 60},${120 + Math.random() * 60},${118 + Math.random() * 60},${Math.random() * 0.25})`;
      c.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 14; i++) {               // grietas
      c.strokeStyle = 'rgba(10,10,12,.75)'; c.lineWidth = 1 + Math.random() * 2;
      c.beginPath(); let x = Math.random() * s, y = Math.random() * s; c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 70; y += (Math.random() - 0.5) * 70; c.lineTo(x, y); }
      c.stroke();
    }
    for (let i = 0; i < 7; i++) {                // manchas de aceite
      const g = c.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 40 + Math.random() * 60);
      g.addColorStop(0, 'rgba(8,8,9,.55)'); g.addColorStop(1, 'rgba(8,8,9,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
    noiseOverlay(c, s, 26);
  }, 6, 26),

  concrete: (tint) => makeTexture(256, (c, s) => {
    c.fillStyle = tint || '#8a8579'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(0,0,0,${Math.random() * 0.10})`;
      c.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 5, 2 + Math.random() * 5);
    }
    for (let i = 0; i < 22; i++) {               // humedad
      c.fillStyle = `rgba(40,38,30,${0.04 + Math.random() * 0.08})`;
      c.beginPath(); c.ellipse(Math.random() * s, Math.random() * s, 10 + Math.random() * 34, 20 + Math.random() * 60, 0, 0, Math.PI * 2); c.fill();
    }
    noiseOverlay(c, s, 18);
  }, 2, 2),

  brick: () => makeTexture(256, (c, s) => {
    c.fillStyle = '#4a4038'; c.fillRect(0, 0, s, s);
    const bw = 64, bh = 32;
    for (let row = 0; row < s / bh; row++) {
      for (let col = -1; col < s / bw + 1; col++) {
        const off = (row % 2) * bw / 2;
        const r = 88 + Math.random() * 26, g2 = 60 + Math.random() * 20, b = 48 + Math.random() * 16;
        c.fillStyle = `rgb(${r | 0},${g2 | 0},${b | 0})`;
        c.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    noiseOverlay(c, s, 22);
  }, 3, 3),

  rust: () => makeTexture(256, (c, s) => {
    c.fillStyle = '#4b3a2c'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      const r = 60 + Math.random() * 90;
      c.fillStyle = `rgba(${110 + r * 0.5 | 0},${55 + r * 0.25 | 0},${20 + r * 0.1 | 0},${0.25 + Math.random() * 0.4})`;
      c.beginPath(); c.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 26, 0, Math.PI * 2); c.fill();
    }
    noiseOverlay(c, s, 40);
  }, 1, 1),

  wood: () => makeTexture(256, (c, s) => {
    c.fillStyle = '#5b4630'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      c.strokeStyle = `rgba(${30 + Math.random() * 40},${20 + Math.random() * 30},10,.5)`;
      c.lineWidth = 1 + Math.random() * 2; c.beginPath();
      const y = Math.random() * s; c.moveTo(0, y);
      for (let x = 0; x < s; x += 16) c.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
      c.stroke();
    }
    noiseOverlay(c, s, 24);
  }, 2, 2),

  metal: () => makeTexture(128, (c, s) => {
    c.fillStyle = '#5e635f'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 16) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, i, s, 1); }
    noiseOverlay(c, s, 30);
  }, 3, 3)
};

// ------------------------------------------------------------------ utilidades
const BOX = new THREE.BoxGeometry(1, 1, 1);

function block(w, h, d, x, y, z, material, opts) {
  const m = new THREE.Mesh(BOX, material);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.castShadow = !(opts && opts.noCast);
  m.receiveShadow = true;
  return m;
}

function cylinder(r, h, seg, x, y, z, material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// =====================================================================
//  WORLD
// =====================================================================
function buildWorld(scene) {
  const world = { colliders: [], pickupSpots: [], zoneMarkers: [], exit: null, bounds: { minZ: -40, maxZ: 175 } };
  scene.add(new THREE.AmbientLight(0x8890a0, 0.45));

  // ---------------- cielo nocturno con gradiente (esfera invertida)
  const skyTex = makeTexture(256, (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0.00, '#070d18'); g.addColorStop(0.45, '#12141f');
    g.addColorStop(0.72, '#3a2a20'); g.addColorStop(0.86, '#5b3a22'); g.addColorStop(1.0, '#1a1512');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) {
      c.fillStyle = `rgba(255,${230 + Math.random() * 25 | 0},${200 + Math.random() * 40 | 0},${Math.random() * 0.7})`;
      c.fillRect(Math.random() * s, Math.random() * s * 0.55, 1, 1);
    }
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })));

  const hemi = new THREE.HemisphereLight(0x6b7fa0, 0x2a2118, 0.55);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd0ff, 0.55);
  moon.position.set(-60, 90, 40); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -70; moon.shadow.camera.right = 70;
  moon.shadow.camera.top = 190; moon.shadow.camera.bottom = -40;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 300;
  moon.shadow.bias = -0.0008;
  scene.add(moon);

  // ---------------- materiales compartidos
  const M = {
    asphalt: new THREE.MeshStandardMaterial({ map: TEX.asphalt(), roughness: 0.94, metalness: 0.05, color: 0xbfbfbf }),
    concrete: new THREE.MeshStandardMaterial({ map: TEX.concrete('#7d7a70'), roughness: 0.95, metalness: 0.02 }),
    concreteDark: new THREE.MeshStandardMaterial({ map: TEX.concrete('#5a5850'), roughness: 0.95 }),
    brick: new THREE.MeshStandardMaterial({ map: TEX.brick(), roughness: 0.98 }),
    rust: new THREE.MeshStandardMaterial({ map: TEX.rust(), roughness: 0.85, metalness: 0.35 }),
    wood: new THREE.MeshStandardMaterial({ map: TEX.wood(), roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ map: TEX.metal(), roughness: 0.55, metalness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1416, roughness: 0.15, metalness: 0.9, emissive: 0x0a1a1c }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.8 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xd8a52a, roughness: 0.7 }),
    barrel: new THREE.MeshStandardMaterial({ map: TEX.rust(), color: 0xa04a28, roughness: 0.7, metalness: 0.4 })
  };

  // ---------------- helpers de colisión
  function solid(w, h, d, x, y, z, mat, o) {
    const m = block(w, h, d, x, y, z, mat, o);
    scene.add(m);
    if (!(o && o.noCollide)) addCollider(w, h, d, x, y, z);
    return m;
  }
  function addCollider(w, h, d, x, y, z) {
    // AABB en planta (el movimiento del jugador es 2D sobre el plano XZ)
    world.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y + h, kind: 'wall' });
  }

  // ---------------- suelo
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.asphalt);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  TEX.asphaltRepeat = true;
  scene.add(floor);

  // ---------------- límites del escenario (muros invisibles + paredes visibles)
  const W = 12;                 // semiancho de la calle principal
  const zStart = -6, zEnd = 168; // extremos del recorrido
  // paredes laterales visibles (edificios) + límites de colisión
  function buildingWall(sideX, z0, z1, height, mat, depth) {
    const depthZ = z1 - z0;
    const mesh = block(depth || 1.2, height, depthZ, sideX, 0, (z0 + z1) / 2, mat);
    scene.add(mesh);
    addCollider(depth || 1.2, height, depthZ, sideX, 0, (z0 + z1) / 2);
    return mesh;
  }

  // ---------- ESCENARIO: bordes del sector (pared de chapa + valla)
  buildingWall(-W, zStart, zEnd, 6, M.brick);
  buildingWall(W, zStart, zEnd, 6, M.brick);

  // ---------- fachadas con ventanas y letreros (detalle visual)
  function facadeWindowGrid(sideX, z0, z1, yBase, rows, mat) {
    const step = 4;
    for (let z = z0 + 2; z < z1 - 1; z += step) {
      for (let r = 0; r < rows; r++) {
        const lit = Math.random() < 0.14;
        const w = block(0.08, 1.15, 1.5, sideX + (sideX < 0 ? 0.63 : -0.63), yBase + r * 1.9, z, lit ?
          new THREE.MeshStandardMaterial({ color: 0x20160a, emissive: 0xffb060, emissiveIntensity: 1.6, roughness: 0.4 }) : M.glass, { noCast: true });
        scene.add(w);
      }
    }
  }
  facadeWindowGrid(-W, zStart, 62, 1.6, 2);
  facadeWindowGrid(W, zStart, 62, 1.6, 2);
  facadeWindowGrid(-W, 78, zEnd, 1.6, 2);
  facadeWindowGrid(W, 78, zEnd, 1.6, 2);

  // ===========================================================
  //  ZONA 1 — BASE / PUNTO DE INICIO  (z: 8 .. 30)
  // ===========================================================
  const startHut = block(9, 3.4, 8, -7.2, 0, 17, M.concreteDark);
  startHut.castShadow = true; scene.add(startHut);
  addCollider(9, 3.4, 8, -7.2, 0, 17);
  // techo de chapa
  const roof = block(9.6, 0.3, 8.6, -7.2, 3.4, 17, M.metal);
  scene.add(roof);
  // puerta de la base
  solid(1.6, 2.4, 0.14, -2.6, 0, 13.2, M.hazard, { noCollide: true });

  // barricadas de entrada (obligan a rodear / buscar hueco)
  const barricade = (x, z, rotY, len) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = rotY;
    const plank1 = block(len, 0.28, 0.10, 0, 0.75, 0, M.wood);
    const plank2 = block(len, 0.28, 0.10, 0, 1.18, 0, M.wood);
    const legL = block(0.18, 1.35, 0.18, -len / 2 + 0.2, 0, 0, M.wood);
    const legR = block(0.18, 1.35, 0.18, len / 2 - 0.2, 0, 0, M.wood);
    g.add(plank1, plank2, legL, legR); scene.add(g);
    if (Math.abs(Math.sin(rotY)) > 0.5) addCollider(0.6, 1.35, len, x, 0, z);
    else addCollider(len, 1.35, 0.6, x, 0, z);
  };
  barricade(-5.4, 30.5, 0, 6.5);
  barricade(4.2, 36, 0, 6.0);

  // torre de vigilancia de la base (punto de referencia del inicio)
  solid(2.6, 0.25, 2.6, -9.4, 4.4, 26, M.metal);
  solid(0.2, 4.4, 0.2, -10.5, 0, 24.9, M.metal);
  solid(0.2, 4.4, 0.2, -8.3, 0, 24.9, M.metal);
  solid(0.2, 4.4, 0.2, -10.5, 0, 27.1, M.metal);
  solid(0.2, 4.4, 0.2, -8.3, 0, 27.1, M.metal);

  // letrero de la base
  const signTex = makeTexture(512, (c, s) => {
    c.fillStyle = '#141414'; c.fillRect(0, 0, s, s);
    c.strokeStyle = '#c9a227'; c.lineWidth = 10; c.strokeRect(14, 14, s - 28, s - 28);
    c.fillStyle = '#e8e0cf'; c.font = 'bold 78px Consolas,monospace'; c.textAlign = 'center';
    c.fillText('SECTOR 7', s / 2, s / 2 - 20);
    c.fillStyle = '#c9a227'; c.font = 'bold 40px Consolas,monospace';
    c.fillText('PUNTO DE ENTRADA', s / 2, s / 2 + 55);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2 * 0.55),
    new THREE.MeshStandardMaterial({ map: signTex, emissive: 0x554422, emissiveMap: signTex, roughness: 0.7 }));
  sign.position.set(-2.55, 2.4, 31.2); sign.rotation.y = Math.PI;
  scene.add(sign);

  // ===========================================================
  //  CALLE PRINCIPAL — vehículos abandonados, contenedores, escombros
  // ===========================================================
  function wreckCar(x, z, rotY, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    const bodyMat = new THREE.MeshStandardMaterial({ map: TEX.rust(), color, roughness: 0.8, metalness: 0.5 });
    const body = block(1.85, 0.72, 4.1, 0, 0.22, 0, bodyMat);
    const cabin = block(1.65, 0.62, 2.0, 0, 0.94, -0.15, M.glass);
    const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12);
    [[-0.92, 1.35], [0.92, 1.35], [-0.92, -1.35], [0.92, -1.35]].forEach(p => {
      const wh = new THREE.Mesh(wheel, M.tire); wh.rotation.z = Math.PI / 2;
      wh.position.set(p[0], 0.33, p[1]); wh.castShadow = true; g.add(wh);
    });
    g.add(body, cabin); scene.add(g);
    const s = Math.abs(Math.cos(rotY));
    addCollider(s > 0.5 ? 1.9 : 4.1, 1.0, s > 0.5 ? 4.1 : 1.9, x, 0, z);
  }
  wreckCar(-6.4, 42, 0.12, 0x8a3b2a);
  wreckCar(6.9, 47.5, -0.22, 0x3b4a62);
  wreckCar(0.4, 58, 1.35, 0x5c5a45);

  function container(x, z, rotY, color) {
    const mat = new THREE.MeshStandardMaterial({ map: TEX.rust(), color, roughness: 0.75, metalness: 0.55 });
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    const body = block(2.4, 2.5, 6, 0, 0, 0, mat);
    g.add(body); scene.add(g);
    const s = Math.abs(Math.cos(rotY));
    addCollider(s > 0.5 ? 2.4 : 6, 2.5, s > 0.5 ? 6 : 2.4, x, 0, z);
  }
  container(-9.6, 54, 0, 0x2f4a3a);
  container(9.4, 68, 0.35, 0x6b2a24);
  container(-8.6, 92, 0, 0x3a4a63);

  function pallet(x, z, rotY) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    for (let i = 0; i < 5; i++) g.add(block(1.2, 0.06, 0.16, 0, 0.1 + i * 0.14, 0, M.wood));
    scene.add(g); addCollider(1.3, 0.9, 1.3, x, 0, z);
  }
  pallet(-3.2, 50, 0.3); pallet(7.2, 74, -0.2); pallet(-6.8, 78, 0.5);

  // barriles (algunos explosionan visualmente al recibir un disparo)
  function barrel(x, z, color) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 14),
      new THREE.MeshStandardMaterial({ map: TEX.rust(), color: color || 0xa8552e, roughness: 0.7, metalness: 0.4 }));
    m.position.set(x, 0.475, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    addCollider(0.7, 0.95, 0.7, x, 0, z);
    return m;
  }
  barrel(-2.4, 63); barrel(-1.9, 63.7); barrel(8.2, 36, 0x4a6b2a); barrel(5.4, 96, 0x2f4a6b);

  // escombros y sacos de arena (obstáculos bajos)
  function sandbags(x, z, len, rotY) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor(len / 0.62); i++) {
      const b = block(0.6, 0.26, 0.34, -len / 2 + 0.3 + i * 0.62 + (r % 2) * 0.15, r * 0.26, 0,
        new THREE.MeshStandardMaterial({ color: 0x7c7359, roughness: 1 }));
      g.add(b);
    }
    scene.add(g);
    const s = Math.abs(Math.cos(rotY));
    addCollider(s > 0.5 ? len : 0.5, 0.8, s > 0.5 ? 0.5 : len, x, 0, z);
  }
  sandbags(6.2, 52, 3.6, 0); sandbags(-6.0, 66, 3.0, 0); sandbags(3.0, 84, 4.2, 0);

  // postes de luz (iluminación de ambiente + referencia de avance)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffcf8a, emissiveIntensity: 2.2, roughness: 0.5 });
  function lampPost(x, z, broken) {
    solid(0.16, 5.2, 0.16, x, 0, z, M.metal);
    if (!broken) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampMat);
      bulb.position.set(x + (x < 0 ? 0.45 : -0.45), 5.0, z); scene.add(bulb);
      const light = new THREE.PointLight(0xffb066, 14, 16, 2);
      light.position.copy(bulb.position); scene.add(light);
    }
  }
  lampPost(-10.4, 34, false); lampPost(10.4, 40, true);
  lampPost(-10.4, 60, true); lampPost(10.4, 74, false);
  lampPost(-10.4, 96, false); lampPost(10.4, 112, true);
  lampPost(-10.4, 132, false);

  // charcos con brillo
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.75 });
  [[2.5, 44, 3.4], [-4, 70, 2.6], [5.5, 88, 3.8], [-1.5, 116, 2.9], [4, 140, 3.2]].forEach(p => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p[2] / 2, 18), puddleMat);
    m.rotation.x = -Math.PI / 2; m.position.set(p[0], 0.012, p[1]); m.scale.z = 1.6;
    scene.add(m);
  });

  // marcas viales (guían el recorrido)
  for (let z = 34; z < 164; z += 7) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.6), new THREE.MeshStandardMaterial({ color: 0xb9b2a0, roughness: 0.9 }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.02, z); scene.add(dash);
  }

  // ===========================================================
  //  CALLEJÓN — paso estrecho entre muros (z: 96..118)
  // ===========================================================
  const alleyL = block(1.0, 4.2, 22, -7.4, 1.8, 107, M.concreteDark);
  const alleyR = block(1.0, 4.2, 22, 7.4, 1.8, 107, M.concreteDark);
  scene.add(alleyL, alleyR);
  addCollider(1.0, 4.2, 22, -7.4, 1.8, 107); addCollider(1.0, 4.2, 22, 7.4, 1.8, 107);
  // vigas en altura sobre el callejón
  for (let z = 99; z < 118; z += 6) scene.add(block(16.2, 0.4, 0.5, 0, 4.2, z, M.rust));

  // ===========================================================
  //  MERCADO — puestos y cajas (z: 120..150)
  // ===========================================================
  function stall(x, z, rotY) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    g.add(block(3.0, 0.9, 1.4, 0, 0, 0, M.wood));
    for (const sx of [-1.4, 1.4]) for (const sz of [-0.6, 0.6]) g.add(block(0.08, 2.4, 0.08, sx, 0, sz, M.metal));
    g.add(block(3.2, 0.12, 1.8, 0, 2.4, 0, new THREE.MeshStandardMaterial({ color: 0x8a2f27, roughness: 0.9 })));
    scene.add(g); addCollider(3.2, 2.5, 1.8, x, 0, z);
  }
  stall(-7.6, 126, 0); stall(7.4, 133, 0); stall(-7.2, 142, 0);

  // ===========================================================
  //  ZONA DE EXTRACCIÓN (RF08) — helipuerto al final
  // ===========================================================
  const ex = CONFIG.level.exitPosition;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.4, 0.22, 40), M.concrete);
  pad.position.set(ex[0], 0.11, ex[2]); pad.receiveShadow = true; scene.add(pad);

  const padTex = makeTexture(512, (c, s) => {
    c.clearRect(0, 0, s, s);
    c.strokeStyle = '#d9d2c0'; c.lineWidth = 18; c.beginPath(); c.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#d9d2c0'; c.font = 'bold 190px Impact,Haettenschweiler,sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', s / 2, s / 2 + 8);
    c.fillStyle = 'rgba(200,60,40,.85)'; c.fillRect(s * 0.5 - 8, 0, 16, s * 0.14);
  });
  const padMark = new THREE.Mesh(new THREE.CircleGeometry(5.9, 40),
    new THREE.MeshStandardMaterial({ map: padTex, transparent: true, roughness: 0.9 }));
  padMark.rotation.x = -Math.PI / 2; padMark.position.set(ex[0], 0.235, ex[2]); scene.add(padMark);

  // caja de extracción (volumen que dispara la victoria)
  const exitZone = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.level.exitRadius, CONFIG.level.exitRadius, 6, 28, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x5fe08b, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  exitZone.position.set(ex[0], 3, ex[2]); scene.add(exitZone);
  world.exit = { mesh: exitZone, center: new THREE.Vector3(ex[0], 0, ex[2]), radius: CONFIG.level.exitRadius };

  // balizas luminosas alrededor de la zona
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x6bff9a, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), beaconMat);
    b.position.set(ex[0] + Math.cos(a) * 6.0, 1.1, ex[2] + Math.sin(a) * 6.0);
    scene.add(b);
  }
  const exitLight = new THREE.PointLight(0x6bff9a, 25, 22, 2);
  exitLight.position.set(ex[0], 4.5, ex[2]); scene.add(exitLight);

  // helipuerto: valla en U para obligar a entrar por el frente
  sandbags(ex[0] - 6.6, ex[2], 8, 1.57); sandbags(ex[0] + 6.6, ex[2], 8, 1.57);
  solid(10.4, 1.2, 0.4, ex[0], 0, ex[2] + 6.8, M.concreteDark);

  // letrero de extracción
  const exitSignTex = makeTexture(512, (c, s) => {
    c.fillStyle = '#0b1a10'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#6bff9a'; c.font = 'bold 66px Consolas,monospace'; c.textAlign = 'center';
    c.fillText('EXTRACCIÓN', s / 2, s / 2 - 10);
    c.font = 'bold 34px Consolas,monospace'; c.fillText('ZONA SEGURA  ·  150 m', s / 2, s / 2 + 55);
    c.strokeStyle = '#6bff9a'; c.lineWidth = 8; c.strokeRect(12, 12, s - 24, s - 24);
  });
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(5, 5 * 0.55),
    new THREE.MeshBasicMaterial({ map: exitSignTex, transparent: false }));
  exitSign.position.set(ex[0], 3.2, ex[2] + 6.6); exitSign.rotation.y = Math.PI;
  scene.add(exitSign);

  // barra de progreso física: muros que cierran el paso al norte del helipuerto
  solid(26, 6, 1.0, 0, 0, 160, M.concreteDark);
  // superficie de la zona norte
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(24, 26), M.concreteDark);
  lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.015, 150); lot.receiveShadow = true; scene.add(lot);

  // ===========================================================
  //  ZONAS DE APARICIÓN DE LOS ZOMBIS (RF03/RF11)
  //  Tres oleadas en profundidad, la última más densa.
  // ===========================================================
  world.spawnZones = [
    { name: 'ZONA 1 · CALLE PRINCIPAL', x: [-8, 8], z: [40, 92], count: 6, run: 0.0, spread: 0 },
    { name: 'ZONA 2 · CALLEJÓN', x: [-6, 6], z: [98, 118], count: 5, run: 0.5, spread: 0.6 },
    { name: 'ZONA 3 · MERCADO', x: [-8.5, 8.5], z: [122, 152], count: 6, run: 1.0, spread: 1.4 }
  ];

  // ===========================================================
  //  OBJETOS COLECCIONABLES (RF10 / RF02)
  //  Los puntos se registran y enemies/player resuelven la recogida.
  // ===========================================================
  function registerPickup(type, x, z, y) {
    world.pickupSpots.push({ type, position: new THREE.Vector3(x, y || 0, z) });
  }
  // cajas de munición: cubren el recorrido y premian la exploración lateral
  registerPickup('ammo', -8.6, 38.5);
  registerPickup('ammo', 9.2, 62);
  registerPickup('ammo', -9.0, 86);
  registerPickup('ammo', 0.0, 112);
  registerPickup('ammo', 8.4, 139);
  registerPickup('ammo', -4.2, 156, 0.24);
  // botiquines y potenciador de velocidad
  registerPickup('medkit', -9.4, 72);
  registerPickup('medkit', 6.6, 128);
  registerPickup('speed', 1.6, 78);
  registerPickup('speed', -5.8, 148);

  // ===========================================================
  //  AUDIO AMBIENTE: retumbe lejano (opcional)
  // ===========================================================

  // vuelve a calcular el bounding del escenario para el minimapa
  world.bounds = { minX: -W, maxX: W, minZ: -6, maxZ: 161 };
  world.startPosition = new THREE.Vector3(0, 0, 12);
  world.startYaw = 0; // mirando hacia +Z
  return world;
}
