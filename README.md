# Operación Extracción: Sobrevive al apocalipsis

Videojuego 3D de disparos en primera persona (FPS), desarrollado con **JavaScript** y **Three.js (WebGL)**. El jugador debe recorrer un escenario urbano, enfrentarse a zombis, administrar la munición de dos armas y llegar a la zona segura de extracción.

## 1. Contenido del repositorio

```text
operacion-extraccion-fps/
├── assets/
│   └── models/
│       ├── arma1.glb
│       ├── arma2.glb
│       └── zombi.glb
├── index.html
├── style.css
├── main.js
├── README.md
└── .gitignore
```

## 2. Requisitos y dependencias

- Navegador actualizado compatible con WebGL y módulos JavaScript (Chrome, Edge o Firefox).
- Conexión a Internet para cargar Three.js desde un CDN.
- Servidor web local para ejecutar el proyecto; no abrir directamente como archivo por las restricciones CORS.
- Three.js **0.160.0**, cargado desde un CDN mediante `importmap`.
- `PointerLockControls` y `GLTFLoader`, módulos auxiliares de la misma versión de Three.js.
- No es necesario instalar `node_modules`.

## 3. Instalación y ejecución local

### Opción A: Visual Studio Code + Live Server

1. Descarga el repositorio y descomprime los archivos.
2. Abre la carpeta del proyecto en Visual Studio Code.
3. Instala la extensión **Live Server**.
4. Haz clic derecho sobre `index.html` y selecciona **Open with Live Server**.
5. Pulsa **INICIAR MISIÓN** y permite la captura del cursor.

### Opción B: Python

Desde una terminal abierta en la carpeta del proyecto, ejecuta:

```bash
python -m http.server 8080
```

Después abre `http://localhost:8080` en el navegador.

## 4. Controles

| Tecla / control | Acción |
|---|---|
| W | Avanzar |
| S | Retroceder |
| A | Desplazarse a la izquierda |
| D | Desplazarse a la derecha |
| Movimiento del mouse | Orientar la cámara y apuntar |
| Clic izquierdo | Disparar una vez |
| 1 | Seleccionar la pistola táctica |
| 2 | Seleccionar el rifle de asalto |
| Esc | Liberar el cursor |
| Botón INICIAR MISIÓN | Comenzar la partida |
| Botón REINICIAR PARTIDA | Reiniciar después de victoria o derrota |

## 5. Requerimientos funcionales documentados

- **RF01 – Sistema de armas:** dos modelos 3D y selección con las teclas 1 y 2.
- **RF02 – Munición:** contador independiente por arma; el disparo se bloquea al llegar a cero.
- **RF03 – Escenario 3D:** recorrido con zona inicial, muros, obstáculos y punto de extracción.
- **RF04 – Modelos de zombis:** enemigos cargados desde `zombi.glb`.
- **RF05 – Detección y persecución:** los zombis se activan al entrar el jugador en su radio de detección.
- **RF06 – Cámara FPS:** controles de mouse y desplazamiento WASD.
- **RF07 – Impactos:** detección mediante `Raycaster`; cada zombi tiene dos puntos de resistencia.
- **RF08 – Victoria:** alcanzar la zona señalizada de extracción.
- **RF09 – Derrota:** contacto cercano con un zombi activo.
- **RF10 – Reabastecimiento:** cajas coleccionables que recuperan munición del arma correspondiente.
- **RF11 – Distribución de dificultad:** enemigos distribuidos por el escenario con distintos rangos y velocidades.
- **RF12 – Repositorio y documentación:** código, modelos y documentación reunidos en este repositorio.

## 6. Recursos externos, dependencias y créditos

- **Three.js 0.160.0:** biblioteca de renderizado 3D mediante WebGL: https://threejs.org/
- **PointerLockControls y GLTFLoader:** módulos incluidos en los ejemplos oficiales de Three.js 0.160.0.
- **Modelos 3D:** `arma1.glb`, `arma2.glb` y `zombi.glb`, incluidos en `assets/models/`.

Los archivos recibidos no incluyen información verificable sobre autor, página de descarga o licencia original de los tres modelos. Por ello, no se atribuye su autoría a Sketchfab, Kenney ni a una licencia Creative Commons sin confirmación. Completa esos créditos si dispones de las fuentes originales.

## 7. Repositorio de GitHub

Repositorio público: https://github.com/Dark202407/operacion-extraccion-fps

## 8. Publicación opcional con GitHub Pages

1. Abre **Settings → Pages**.
2. En **Build and deployment**, selecciona **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/(root)`.
4. Guarda los cambios y espera a que termine la publicación.
5. Comprueba que el juego y los modelos carguen correctamente.

URL prevista: https://Dark202407.github.io/operacion-extraccion-fps/

La dirección solo funcionará después de activar GitHub Pages y completar la publicación.

## 9. Comprobaciones antes de entregar

- [ ] Repositorio público y código fuente accesible.
- [ ] Se encuentran los tres modelos GLB en `assets/models/`.
- [ ] README visible en la página principal.
- [ ] Juego probado en un servidor local.
- [ ] Movimiento, armas, disparos y munición probados.
- [ ] Recolección, victoria y derrota comprobadas.
- [ ] Créditos y licencias de los modelos completados con datos verificables.
- [ ] GitHub Pages probado, si se entrega el enlace opcional.

**Nota:** el video demostrativo de hasta tres minutos es un entregable separado y no forma parte de este repositorio.
