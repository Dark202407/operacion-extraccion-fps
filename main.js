import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141821);
scene.fog = new THREE.Fog(0x141821, 18, 95);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const START_POS = new THREE.Vector3(0, 1.7, 52);
camera.position.copy(START_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xdbeafe, 0.75));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
dirLight.position.set(20, 40, 25);
dirLight.castShadow = true;
scene.add(dirLight);
const extractionLight = new THREE.PointLight(0x00ff88, 3, 22);
extractionLight.position.set(0, 3.5, -52);
scene.add(extractionLight);

const controls = new PointerLockControls(camera, document.body);
const overlay = document.getElementById('overlay');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
let gameState = 'MENU';

btnStart.addEventListener('click', () => {
  if (gameState !== 'ENDED') controls.lock();
});
btnRestart.addEventListener('click', () => location.reload());
controls.addEventListener('lock', () => {
  if (gameState !== 'ENDED') {
    gameState = 'PLAYING';
    overlay.classList.add('hidden');
  }
});
controls.addEventListener('unlock', () => {
  if (gameState === 'PLAYING') {
    gameState = 'MENU';
    overlay.classList.remove('hidden');
  }
});

const weapons = {
  1: { name: 'Pistola Táctica [1]', ammo: 8, model: null, recoil: 0.08 },
  2: { name: 'Rifle de Asalto [2]', ammo: 10, model: null, recoil: 0.12 }
};
let currentWeapon = 1;
let kills = 0;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

function updateHUD() {
  const activeW = weapons[currentWeapon];
  const ammoEl = document.getElementById('hud-ammo');
  document.getElementById('hud-weapon').textContent = activeW.name;
  ammoEl.textContent = activeW.ammo;
  ammoEl.className = activeW.ammo === 0 ? 'danger' : 'accent';
  document.getElementById('hud-kills').textContent = kills;
  document.getElementById('hud-total-zombies').textContent = zombies.length;
  const distToExit = Math.max(0, Math.round(camera.position.distanceTo(new THREE.Vector3(0, 1.7, -52))));
  document.getElementById('hud-distance').textContent = distToExit;
  const stageEl = document.getElementById('hud-stage');
  if (camera.position.z > 38) stageEl.textContent = '1. ZONA INICIAL SEGURA';
  else if (camera.position.z > -44) stageEl.textContent = '2. ZONA INFECTADA';
  else stageEl.textContent = '3. PUNTO DE EXTRACCIÓN';
}

const obstacles = [];
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 120),
  new THREE.MeshStandardMaterial({ color: 0x262b36, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const roadStripe = new THREE.Mesh(
  new THREE.PlaneGeometry(4, 116),
  new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.95 })
);
roadStripe.rotation.x = -Math.PI / 2;
roadStripe.position.y = 0.01;
scene.add(roadStripe);

function createWall(w, h, d, x, y, z, color = 0x3b4252) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push(new THREE.Box3().setFromObject(mesh));
  return mesh;
}

createWall(46, 6, 1.5, 0, 3, 60, 0x2e3440);
createWall(46, 6, 1.5, 0, 3, -60, 0x2e3440);
createWall(1.5, 6, 120, -23, 3, 0, 0x2e3440);
createWall(1.5, 6, 120, 23, 3, 0, 0x2e3440);

const startPad = new THREE.Mesh(
  new THREE.BoxGeometry(12, 0.12, 10),
  new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.35 })
);
startPad.position.set(0, 0.06, 52);
scene.add(startPad);

createWall(16, 4.5, 2.5, -8, 2.25, 36, 0x434c5e);
createWall(14, 4.5, 2.5, 9, 2.25, 22, 0x4c566a);
createWall(10, 5.5, 10, -11, 2.75, 6, 0x3b4252);
createWall(14, 4.5, 2.5, 8, 2.25, -6, 0x434c5e);
createWall(16, 4.5, 2.5, -7, 2.25, -22, 0x4c566a);
createWall(12, 4.5, 2.5, 9, 2.25, -36, 0x434c5e);

const extractionZone = new THREE.Mesh(
  new THREE.BoxGeometry(10, 0.25, 10),
  new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00aa55, emissiveIntensity: 0.6 })
);
extractionZone.position.set(0, 0.125, -52);
scene.add(extractionZone);
const extractionBox = new THREE.Box3().setFromObject(extractionZone);
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.25, 0.25, 5, 16),
  new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.8 })
);
beacon.position.set(0, 2.5, -52);
scene.add(beacon);

const ammoPickups = [];
function spawnAmmoBox(x, z, weaponId, amount) {
  const color = weaponId === 1 ? 0xf59e0b : 0x38bdf8;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.65, 0.9),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25 })
  );
  mesh.position.set(x, 0.45, z);
  mesh.castShadow = true;
  scene.add(mesh);
  ammoPickups.push({ mesh, weaponId, amount, collected: false });
}
spawnAmmoBox(-16, 30, 1, 6);
spawnAmmoBox(16, 15, 2, 8);
spawnAmmoBox(-18, -4, 1, 8);
spawnAmmoBox(15, -24, 2, 8);
spawnAmmoBox(-15, -42, 1, 6);

const loader = new GLTFLoader();
scene.add(camera);

function loadWeapons() {
  loader.load('./assets/models/arma1.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0.32, -0.26, -0.52);
    camera.add(model);
    weapons[1].model = model;
    selectWeapon(1);
  });
  loader.load('./assets/models/arma2.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0.32, -0.28, -0.58);
    model.visible = false;
    camera.add(model);
    weapons[2].model = model;
  });
}

function selectWeapon(num) {
  currentWeapon = num;
  if (weapons[1].model) weapons[1].model.visible = num === 1;
  if (weapons[2].model) weapons[2].model.visible = num === 2;
  updateHUD();
}

const zombies = [];
const zombieConfigs = [
  { x: -12, z: 26, range: 15, speed: 2.6 },
  { x: 12, z: 12, range: 16, speed: 2.8 },
  { x: 3, z: 2, range: 15, speed: 3.0 },
  { x: -15, z: -12, range: 17, speed: 3.1 },
  { x: 11, z: -16, range: 16, speed: 2.9 },
  { x: -4, z: -30, range: 18, speed: 3.4 },
  { x: 12, z: -42, range: 18, speed: 3.5 },
  { x: -10, z: -46, range: 18, speed: 3.5 }
];

function spawnZombies() {
  loader.load('./assets/models/zombi.glb', (gltf) => {
    zombieConfigs.forEach((cfg) => {
      const zModel = gltf.scene.clone();
      zModel.position.set(cfg.x, 0, cfg.z);
      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 2.0, 0.95),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitbox.position.set(0, 1.0, 0);
      zModel.add(hitbox);
      scene.add(zModel);
      const zombieData = {
        mesh: zModel, hitbox, hp: 2, alive: true, active: false,
        detectionRange: cfg.range, speed: cfg.speed
      };
      hitbox.userData.zombie = zombieData;
      zombies.push(zombieData);
    });
    updateHUD();
  });
}

const raycaster = new THREE.Raycaster();
window.addEventListener('mousedown', (e) => {
  if (gameState !== 'PLAYING' || e.button !== 0) return;
  const activeW = weapons[currentWeapon];
  if (activeW.ammo <= 0) {
    showToast('¡Sin munición en esta arma! Busca cajas de abastecimiento.');
    return;
  }
  activeW.ammo -= 1;
  updateHUD();
  if (activeW.model) {
    const origZ = activeW.model.position.z;
    activeW.model.position.z = origZ + activeW.recoil;
    setTimeout(() => {
      if (activeW.model) activeW.model.position.z = origZ;
    }, 85);
  }
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const aliveHitboxes = zombies.filter((z) => z.alive).map((z) => z.hitbox);
  const hits = raycaster.intersectObjects(aliveHitboxes, false);
  if (hits.length > 0) {
    const hitZombie = hits[0].object.userData.zombie;
    hitZombie.hp -= 1;
    hitZombie.active = true;
    if (hitZombie.hp <= 0) {
      hitZombie.alive = false;
      hitZombie.mesh.rotation.x = -Math.PI / 2;
      hitZombie.mesh.position.y = 0.25;
      kills += 1;
      updateHUD();
    }
  }
});

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (gameState === 'PLAYING') {
    if (e.code === 'Digit1') selectWeapon(1);
    if (e.code === 'Digit2') selectWeapon(2);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function endGame(victory) {
  if (gameState === 'ENDED') return;
  gameState = 'ENDED';
  controls.unlock();
  const endScreen = document.getElementById('end-screen');
  const title = document.getElementById('end-title');
  const subtitle = document.getElementById('end-subtitle');
  if (victory) {
    title.textContent = '¡MISIÓN COMPLETADA! Has llegado a la zona de extracción';
    title.style.color = '#00ff88';
    title.style.fontSize = '34px';
    subtitle.textContent = `Sobreviviste al recorrido y eliminaste a ${kills} infectados.`;
  } else {
    title.textContent = 'GAME OVER';
    title.style.color = '#ff4d4d';
    title.style.fontSize = '46px';
    subtitle.textContent = 'Un zombi te ha alcanzado y atrapado.';
  }
  endScreen.classList.remove('hidden');
}

const clock = new THREE.Clock();
const PLAYER_SPEED = 7.5;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  beacon.rotation.y += 1.5 * delta;
  if (gameState === 'PLAYING') {
    const prevPos = camera.position.clone();
    if (keys['KeyW']) controls.moveForward(PLAYER_SPEED * delta);
    if (keys['KeyS']) controls.moveForward(-PLAYER_SPEED * delta);
    if (keys['KeyA']) controls.moveRight(-PLAYER_SPEED * delta);
    if (keys['KeyD']) controls.moveRight(PLAYER_SPEED * delta);
    camera.position.y = 1.7;
    const playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(0.85, 1.7, 0.85));
    for (const wallBox of obstacles) {
      if (playerBox.intersectsBox(wallBox)) {
        camera.position.copy(prevPos);
        break;
      }
    }
    if (playerBox.intersectsBox(extractionBox)) endGame(true);
    ammoPickups.forEach((item) => {
      if (!item.collected) {
        item.mesh.rotation.y += 2.2 * delta;
        const dist = camera.position.distanceTo(item.mesh.position);
        if (dist < 1.9) {
          item.collected = true;
          item.mesh.visible = false;
          weapons[item.weaponId].ammo += item.amount;
          showToast(`+${item.amount} balas para ${weapons[item.weaponId].name}`);
          updateHUD();
        }
      }
    });
    const playerFlatPos = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    zombies.forEach((z) => {
      if (!z.alive) return;
      const distToPlayer = z.mesh.position.distanceTo(playerFlatPos);
      if (!z.active && distToPlayer <= z.detectionRange) z.active = true;
      if (z.active) {
        const direction = new THREE.Vector3().subVectors(playerFlatPos, z.mesh.position).normalize();
        const nextZombiePos = z.mesh.position.clone().addScaledVector(direction, z.speed * delta);
        const zombieBox = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(nextZombiePos.x, 1.0, nextZombiePos.z),
          new THREE.Vector3(0.8, 1.8, 0.8)
        );
        let blocked = false;
        for (const wallBox of obstacles) {
          if (zombieBox.intersectsBox(wallBox)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) z.mesh.position.copy(nextZombiePos);
        z.mesh.lookAt(camera.position.x, 0, camera.position.z);
        if (distToPlayer < 1.25) endGame(false);
      }
    });
    updateHUD();
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

loadWeapons();
spawnZombies();
updateHUD();
animate();
