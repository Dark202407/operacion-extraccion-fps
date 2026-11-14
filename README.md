# Operación Extracción: Sobrevive al apocalipsis

> **Repositorio del proyecto (código fuente, recursos y dependencias):**
> https://github.com/Dark202407/operacion-extraccion-fps
>
> **Juego en línea (GitHub Pages):**
> https://dark202407.github.io/operacion-extraccion-fps/
>
> Enlace directo al juego publicado desde la raíz del repositorio:
> https://dark202407.github.io/operacion-extraccion-fps/index.html

Videojuego de disparos en primera persona (FPS) desarrollado con **Three.js (WebGL)**. Incluye las
dos armas y los enemigos en formato **GLB / glTF**, escenario tridimensional explorable, cámara en
primera persona, detección de colisiones, gestión de municiones, comportamiento de persecución de
los zombis, objetos coleccionables y zona final de extracción.

---

## 1. Descripción del juego

El brote arrasó el sector industrial. El jugador es el último operativo dentro del perímetro y debe
atravesar una calle infestada, un callejón y el mercado administrando su munición, para alcanzar el
**helipuerto de extracción** al norte del escenario.

**Objetivo:** sobrevivir al recorrido y llegar a la zona segura de extracción.

**Etapas de la misión (RF08)**

| Etapa | Zona | Qué ocurre |
|---|---|---|
| Inicio | Base «Sector 7» (z ≈ 0–35) | El jugador aparece con las dos armas y 30 balas en total (12 en la pistola + 18 de reserva; 6 en la escopeta). |
| Desarrollo | Calle principal → callejón → mercado (z ≈ 35–150) | Tres oleadas de zombis, vehículos y barricadas, cajas de munición, botiquines y potenciador de velocidad. |
| Final | Helipuerto «H» (z ≈ 150) | Al entrar en el círculo verde se muestra «¡MISIÓN COMPLETADA! Has llegado a la zona de extracción». |

**Condición de derrota (RF09):** si un zombi alcanza al jugador y le quita toda la integridad, aparece
**GAME OVER** y la partida se detiene (con opción de reintentar).

---

## 2. Estructura del proyecto

```
OperacionExtraccion/
├── index.html
├── css/style.css
├── js/
│   ├── config.js     → munición inicial, munición por caja, rangos, dificultad
│   ├── audio.js      → efectos de sonido sintetizados
│   ├── world.js      → escenario 3D, colisiones del mundo y coleccionables
│   ├── weapons.js    → armas GLB, cambio con 1/2, un disparo por clic
│   ├── enemies.js    → zombis GLB, IA de detección/persecución y pickups
│   ├── player.js     → cámara FPS, WASD y colisiones
│   ├── hud.js        → munición, integridad, avisos y pantallas
│   └── game.js       → bucle principal, raycasting, victoria/derrota
├── models/           → pistola.glb, escopeta.glb, zombi.gltf + texturas y buffer
├── libs/             → three.js, GLTFLoader, SkeletonUtils (locales)
├── tools_build_models.py → generador de las armas GLB
└── README.md
```

---

## 3. Instalación y ejecución

**Requisitos:** un navegador actual con WebGL 2 (Chrome, Edge o Firefox). No requiere Node,
compilación ni conexión a internet: las librerías están incluidas en `libs/`.

**Opción A (rápida)** — abrir `index.html` con doble clic.

**Opción B (recomendada)** — servir la carpeta en local y abrir `http://localhost:8000`:

```bash
python3 -m http.server 8000
# o
npx serve .
```

Al cargar se ve la pantalla de inicio: pulsar **INICIAR MISIÓN** y hacer clic sobre el canvas para
capturar el mouse.

### 3.1 Publicar el repositorio en GitHub

```bash
cd OperacionExtraccion
git init
git add .
git commit -m "Operación Extracción: FPS en Three.js con armas y zombis GLB"
git branch -M main
git remote add origin https://github.com/Dark202407/operacion-extraccion-fps.git
git push -u origin main
```

El proyecto está preparado para subirse tal cual: `index.html` debe quedar en la raíz del
repositorio, no dentro de una subcarpeta.

### 3.2 Publicar el juego en línea (opcional)

`Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save`.
La URL resultante es `https://dark202407.github.io/operacion-extraccion-fps/`.

---

## 4. Controles

| Control | Acción |
|---|---|
| W | Avanzar |
| S | Retroceder |
| A | Desplazarse a la izquierda |
| D | Desplazarse a la derecha |
| Movimiento del mouse | Orientar la cámara |
| Clic izquierdo | Disparar una vez (mantener pulsado no dispara en automático) |
| Tecla 1 | Seleccionar arma 1 (pistola) |
| Tecla 2 | Seleccionar arma 2 (escopeta) |
| R | Recargar el cargador desde la reserva del arma |
| Shift | Correr |
| Esc | Liberar el mouse / pausa |

---

## 5. Requisitos funcionales y su ubicación en el código

| Requisito | Implementación | Archivo |
|---|---|---|
| RF01 Sistema de armas: dos armas GLB, teclas 1/2, cambio visible en primera persona, un disparo por clic | `WeaponSystem.load()` / `equip()` / `tryShoot()`; evento `mousedown` ejecutado una sola vez por pulsación | `js/weapons.js`, `js/game.js` |
| RF02 Munición: contador por arma, un consumo por disparo, no se dispara a 0, recogida obligatoria en cajas | `mag` / `def.reserve`, `reloadAuto()`, `onPickup('ammo')` | `js/weapons.js`, `js/game.js`, `js/config.js` |
| RF03 Mundo tridimensional explorable con inicio, recorrido y zona final | `buildWorld()`: base, calle principal, callejón, mercado, helipuerto (≈24 × 168 m) | `js/world.js` |
| RF04 Zombis con modelos GLB | `EnemySystem.load()` + `SkeletonUtils.clone()`, animaciones Idle / Walk / Run | `js/enemies.js` |
| RF05 Comportamiento: estado inactivo y activo por rango de detección configurable | `STATE.IDLE → ALERT → CHASE → ATTACK → DEAD`; `CONFIG.zombies.detectionRange` (13 m) | `js/enemies.js`, `js/config.js` |
| RF06 Cámara en primera persona, WASD y mouse; el arma sigue a la cámara | `Player.look()` con Pointer Lock, `Player.update()` con colisiones; el arma es hija de la cámara | `js/player.js`, `js/weapons.js`, `js/game.js` |
| RF07 Disparos y colisiones: cada zombi tiene 2 puntos y muere exactamente al 2.º impacto | `Game.shoot()` con `THREE.Raycaster`; `EnemySystem.damage()` | `js/game.js`, `js/enemies.js` |
| RF08 Progresión del nivel y zona de extracción con mensaje de victoria | `updateObjective()`, `world.exit`, `Game.win()` | `js/game.js`, `js/world.js` |
| RF09 Derrota: contacto con un zombi provoca GAME OVER y detiene la partida | `Game.enemyAttack()` → `Game.gameOver()` | `js/game.js` |
| RF10 Objetos coleccionables con efecto | `PickupSystem`: caja de munición, botiquín, potenciador de velocidad | `js/enemies.js`, `js/config.js` |
| RF11 Dificultad equilibrada y completable | `spawnZones` en tres oleadas, munición limitada, `zombieSpeedFactor`, obstáculos | `js/world.js`, `js/game.js` |
| RF12 Repositorio y explicación técnica | Este README + sección 5 con la trazabilidad de cada requisito | `README.md` |

**Valores ajustables** (todos en `js/config.js`): munición inicial (pistola 12 + reserva 18; escopeta 6
+ reserva 18), munición por caja (+24 pistola / +12 escopeta), rango de detección de zombis (13 m),
resistencia de los zombis (2 puntos), velocidad y daño de los zombis, integridad del jugador (100)
y duración del potenciador (9 s).

---

## 6. Fuentes de recursos externos

| Recurso | Origen | Licencia / uso |
|---|---|---|
| `models/zombi.gltf` (+ `models/textures`, `models/buffers`) | Modelo «Soldier» de los ejemplos oficiales de three.js (`threejs.org/examples/models/gltf/Soldier.glb`), convertido de GLB a glTF para evitar restricciones de `file://` | Repositorio three.js — uso educativo según su licencia |
| `models/pistola.glb`, `models/escopeta.glb` | Modelos propios generados con `tools_build_models.py` (primitivas agrupadas por material; nodos `cuerpo`, `corredera`, `cargador`, `boca`) | Propios |
| `libs/three.min.js` | three.js r149 | MIT |
| `libs/GLTFLoader.js`, `libs/SkeletonUtils.js` | three.js r147, convertidos a script clásico | MIT |
| Texturas (asfalto, hormigón, ladrillo, óxido, madera, metal, cielo) | Generadas por código con `THREE.CanvasTexture` | Propias |
| Sonidos (disparo, impacto, gruñido, recogida, victoria y derrota) | Sintetizados con la Web Audio API | Propios |

---

## 7. Notas de ejecución

- Si el navegador bloquea la carga de los modelos al abrir el archivo directamente, usar la opción B
  (servidor local).
- El mouse solo controla la cámara después de hacer clic sobre la pantalla (Pointer Lock); `Esc` lo
  libera.
- Si el juego se abre pero no responde al mouse, hacer clic una vez sobre el canvas para capturarlo.
