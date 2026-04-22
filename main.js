import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';

const mountEl = document.getElementById('room3dMount');
const embeddedMode = Boolean(mountEl);
const viewportEl = embeddedMode ? mountEl : document.body;
const viewportWidth  = () => (embeddedMode ? mountEl.clientWidth  : window.innerWidth);
const viewportHeight = () => (embeddedMode ? mountEl.clientHeight : window.innerHeight);
const fadeOverlay = document.getElementById('fade-overlay');

if (!mountEl) throw new Error('Missing #room3dMount in HTML');

/* ─────────────────────────────────────────────
   TOOLTIP  (single shared element on body)
───────────────────────────────────────────── */
const tooltip = document.createElement('div');
tooltip.style.cssText = [
  'position:fixed','top:0','left:0','z-index:300',
  'pointer-events:none',
  'font-family:neue-haas-grotesk-text,Helvetica Neue,Helvetica,sans-serif',
  'font-size:0.95rem','font-weight:400','line-height:1.5',
  'letter-spacing:-0.01em',
  'color:#1a1612',
  'background:rgba(242,238,230,0.96)',
  'border:1px solid rgba(0,0,0,0.08)',
  'backdrop-filter:blur(12px)',
  'border-radius:12px',
  'padding:14px 18px',
  'max-width:260px',
  'box-shadow:0 6px 28px rgba(0,0,0,0.11)',
  'opacity:0',
  'transform:translateY(6px)',
  'transition:opacity 0.22s ease,transform 0.22s ease',
  'white-space:normal',
].join(';');
document.body.appendChild(tooltip);

const tooltipTitle = document.createElement('div');
tooltipTitle.style.cssText = 'font-weight:700;font-size:0.68rem;letter-spacing:0.22em;text-transform:uppercase;opacity:0.4;margin-bottom:5px;';
const tooltipBody = document.createElement('div');
tooltip.appendChild(tooltipTitle);
tooltip.appendChild(tooltipBody);

let tooltipVisible = false;
let tooltipMouseX = 0;
let tooltipMouseY = 0;

function showTooltip(title, body, mx, my) {
  tooltipTitle.textContent = title;
  tooltipBody.textContent  = body;
  positionTooltip(mx, my);
  if (!tooltipVisible) {
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
    tooltipVisible = true;
  }
}
function hideTooltip() {
  if (tooltipVisible) {
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(6px)';
    tooltipVisible = false;
  }
}
function positionTooltip(mx, my) {
  const tw = tooltip.offsetWidth  || 220;
  const th = tooltip.offsetHeight || 60;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let tx = mx + 18;
  let ty = my - 8;
  if (tx + tw > vw - 10) tx = mx - tw - 14;
  if (ty + th > vh - 10) ty = vh - th - 10;
  tooltip.style.left = `${tx}px`;
  tooltip.style.top  = `${ty}px`;
}

/* ─────────────────────────────────────────────
   SCENE
───────────────────────────────────────────── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xede8e0);
scene.fog = new THREE.FogExp2(0xede8e0, 0.010);

/* ─────────────────────────────────────────────
   CAMERA
───────────────────────────────────────────── */
const camera = new THREE.PerspectiveCamera(52, viewportWidth() / Math.max(viewportHeight(), 1), 0.1, 100);
const defaultCamera = { x: 0, y: 2.18, z: 9.2 };
camera.position.set(defaultCamera.x, defaultCamera.y, defaultCamera.z);

let targetCameraX = defaultCamera.x;
let targetCameraY = defaultCamera.y;
let targetCameraZ = defaultCamera.z;
let lookTargetX = 0, lookTargetY = 2.02, lookTargetZ = -7.5;
const currentLook = new THREE.Vector3(0, 2.02, -7.5);
const targetLook  = new THREE.Vector3(0, 2.02, -7.5);
const tempVec     = new THREE.Vector3();

/* ─────────────────────────────────────────────
   RENDERER
───────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(viewportWidth(), viewportHeight());
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.domElement.classList.add('room3d-canvas');
viewportEl.appendChild(renderer.domElement);

/* ─────────────────────────────────────────────
   RAYCASTER
───────────────────────────────────────────── */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-10, -10);
let hoveredDoor     = null;
let hoveredObject   = null; // any interactive non-door object
let selectedDoor    = null;
let isEntering      = false;

/* ─────────────────────────────────────────────
   APPROACH STATE
───────────────────────────────────────────── */
let approachDepth = 0, targetApproachDepth = 0;
const APPROACH_NEAR_Z = 3.8, APPROACH_FAR_Z = defaultCamera.z;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function resetCameraTargets() {
  targetCameraX = defaultCamera.x;
  targetCameraY = defaultCamera.y;
  targetCameraZ = defaultCamera.z;
  lookTargetX = 0; lookTargetY = 2.02; lookTargetZ = -7.5;
}

function resetLandingScene() {
  for (const door of doors) {
    door.userData.isOpen = false;
    door.userData.openProgress = 0;
    door.userData.pivot.rotation.y = 0;
    door.scale.set(1, 1, 1);
  }
  selectedDoor = hoveredDoor = hoveredObject = null;
  isEntering = false;
  approachDepth = 0; targetApproachDepth = 0;
  mouse.set(-10, -10);
  resetCameraTargets();
  camera.position.set(defaultCamera.x, defaultCamera.y, defaultCamera.z);
  currentLook.set(0, 2.02, -7.5);
  targetLook.set(0, 2.02, -7.5);
  renderer.domElement.style.cursor = 'default';
  hideTooltip();
  if (fadeOverlay) fadeOverlay.classList.remove('active');
}
window.resetLandingScene = resetLandingScene;

/* ─────────────────────────────────────────────
   LIGHTS
───────────────────────────────────────────── */
scene.add(new THREE.AmbientLight(0xfaf7f2, 0.80));
scene.add(new THREE.HemisphereLight(0xfffdf0, 0xc8c0b0, 0.70));

const ceilingLight = new THREE.PointLight(0xffeedd, 3.2, 22, 1.6);
ceilingLight.position.set(0, 5.6, -1.5);
ceilingLight.castShadow = true;
ceilingLight.shadow.mapSize.set(2048, 2048);
ceilingLight.shadow.bias = -0.001;
scene.add(ceilingLight);

const ceilingLight2 = new THREE.PointLight(0xfff0d8, 2.0, 18, 1.8);
ceilingLight2.position.set(0, 5.4, -5.0);
scene.add(ceilingLight2);

const frontFill = new THREE.DirectionalLight(0xffffff, 0.28);
frontFill.position.set(0, 3, 11);
scene.add(frontFill);

const leftRim = new THREE.SpotLight(0xffe8cc, 1.1, 22, Math.PI / 5, 0.6, 1.5);
leftRim.position.set(-6.5, 5.2, 0);
leftRim.target.position.set(-6.5, 0, -3);
scene.add(leftRim); scene.add(leftRim.target);

const rightRim = new THREE.SpotLight(0xffe8cc, 1.1, 22, Math.PI / 5, 0.6, 1.5);
rightRim.position.set(6.5, 5.2, 0);
rightRim.target.position.set(6.5, 0, -3);
scene.add(rightRim); scene.add(rightRim.target);

const backWash = new THREE.SpotLight(0xfff6e8, 2.6, 20, Math.PI / 4.5, 0.35, 1.8);
backWash.position.set(0, 6.2, 2.5);
backWash.target.position.set(0, 1.6, -7);
backWash.castShadow = true;
backWash.shadow.mapSize.set(2048, 2048);
backWash.shadow.bias = -0.0015;
scene.add(backWash); scene.add(backWash.target);

scene.add(new THREE.PointLight(0xe8ddd0, 0.6, 14, 2)); // ground bounce at origin

/* Downlights above each door — each one tinted to the door color */
const doorPositionsX = [-3.0, -1.0, 1.0, 3.0];
const downlightColors = [0xffe0d8, 0xd8e0ff, 0xd8ffe0, 0xfff0c8];
doorPositionsX.forEach((dx, i) => {
  const dl = new THREE.SpotLight(downlightColors[i], 1.8, 8, Math.PI / 7, 0.5, 2.0);
  dl.position.set(dx, 5.5, -6.0);
  dl.target.position.set(dx, 0, -6.86);
  scene.add(dl); scene.add(dl.target);
});

/* ─────────────────────────────────────────────
   MATERIALS
───────────────────────────────────────────── */
const wallMat  = new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.88 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: 0.92 });
const ceilMat  = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.95 });
const baseMat  = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.82 });

/* ─────────────────────────────────────────────
   ROOM GEOMETRY
───────────────────────────────────────────── */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 22), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(18, 22), ceilMat);
ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 6, -1); scene.add(ceiling);

const backWallMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 6.2), wallMat);
backWallMesh.position.set(0, 3.1, -7); backWallMesh.receiveShadow = true; scene.add(backWallMesh);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 6.2), wallMat);
leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-7, 3.1, 1.8); scene.add(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 6.2), wallMat);
rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(7, 3.1, 1.8); scene.add(rightWall);

// Skirting + cornice
[[-6.97, 0, 14, 0], [-6.97, Math.PI/2, 22, -6.97], [1.8, -Math.PI/2, 22, 6.97]].forEach(([pz, ry, len, px]) => {
  const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.06), baseMat);
  s.rotation.y = ry; s.position.set(px || 0, 0.09, pz); scene.add(s);
  const c = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.1), baseMat);
  c.rotation.y = ry; c.position.set(px || 0, 5.93, pz); scene.add(c);
});

// Ceiling fixtures
[[-1.5, 0.38, 0.16, 2.2], [-5.0, 0.32, 0.12, 1.8]].forEach(([pz, ringR, bulbR, emissive]) => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ringR, 0.04, 12, 40),
    new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.3, metalness: 0.4 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 5.88, pz); scene.add(ring);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(bulbR, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xfffce8, emissive: 0xffe8a0, emissiveIntensity: emissive, roughness: 0.1 })
  );
  bulb.position.set(0, 5.72, pz); scene.add(bulb);
});

/* ─────────────────────────────────────────────
   PLAQUE ICONS  (canvas textures, drawn in 2D)
───────────────────────────────────────────── */
function makePlaqueTexture(drawFn, doorColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background — slightly lighter than wall, warm stone
  ctx.fillStyle = '#e8e3da';
  roundRect(ctx, 0, 0, size, size, 22);
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 3;
  roundRect(ctx, 2, 2, size - 4, size - 4, 20);
  ctx.stroke();

  // Draw the icon using the door color
  drawFn(ctx, size, doorColor);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgb(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return `rgb(${r},${g},${b})`;
}

// Memory icon: concentric half-circles (like ripples / echo of memory)
function drawMemoryIcon(ctx, size, col) {
  const cx = size / 2, cy = size / 2 + 10;
  ctx.strokeStyle = hexToRgb(col);
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  [38, 58, 78].forEach((r, i) => {
    ctx.globalAlpha = 1 - i * 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.stroke();
  });
  // dot at center-top
  ctx.globalAlpha = 1;
  ctx.fillStyle = hexToRgb(col);
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// Pattern icon: repeating grid of small circles
function drawPatternIcon(ctx, size, col) {
  ctx.fillStyle = hexToRgb(col);
  const cols = 5, rows = 5;
  const spacing = 38, startX = size / 2 - spacing * 2, startY = size / 2 - spacing * 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const alpha = 0.35 + ((r + c) % 3) * 0.22;
      ctx.globalAlpha = Math.min(alpha, 1);
      const radius = 5 + ((r + c) % 2) * 2;
      ctx.beginPath();
      ctx.arc(startX + c * spacing, startY + r * spacing, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Resistance icon: two opposing arcs with a gap — like tension / push-back
function drawResistanceIcon(ctx, size, col) {
  const cx = size / 2, cy = size / 2;
  ctx.strokeStyle = hexToRgb(col);
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  // Left arc pushing right
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(cx - 30, cy, 48, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
  // Right arc pushing left
  ctx.beginPath(); ctx.arc(cx + 30, cy, 48, Math.PI - Math.PI * 0.55, Math.PI + Math.PI * 0.55); ctx.stroke();
  // Gap line in center
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy - 28); ctx.lineTo(cx, cy + 28); ctx.stroke();
  ctx.globalAlpha = 1;
}

// Discomfort icon: jagged zigzag — like a crack or sharp edge
function drawDiscomfortIcon(ctx, size, col) {
  const cx = size / 2, cy = size / 2;
  ctx.strokeStyle = hexToRgb(col);
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 72, cy + 18);
  ctx.lineTo(cx - 30, cy - 34);
  ctx.lineTo(cx,      cy + 20);
  ctx.lineTo(cx + 30, cy - 34);
  ctx.lineTo(cx + 72, cy + 18);
  ctx.stroke();
}

const plaqueDrawFns = {
  memory:     drawMemoryIcon,
  pattern:    drawPatternIcon,
  resistance: drawResistanceIcon,
  discomfort: drawDiscomfortIcon,
};
const doorColors3 = {
  memory: 0xb52828, pattern: 0x3c72b8, resistance: 0x2a6638, discomfort: 0x8a6e1a
};

/* ─────────────────────────────────────────────
   DOORS
───────────────────────────────────────────── */
function createDoor({ color, x, y = 1.6, z = -6.86, name }) {
  const group = new THREE.Group();
  group.userData.name = name;
  group.userData.room = name;
  group.userData.type = 'door';
  group.userData.isOpen = false;
  group.userData.openProgress = 0;

  const pivot = new THREE.Group();
  pivot.position.set(-0.56, 0, 0);
  group.add(pivot);

  const doorMeshGroup = new THREE.Group();
  doorMeshGroup.position.set(0.56, 0, 0.045);
  pivot.add(doorMeshGroup);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 3.32, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xc8c0b5, roughness: 0.88 })
  );
  frame.position.set(0, 0, -0.12); frame.castShadow = true; frame.receiveShadow = true;
  doorMeshGroup.add(frame);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 3.15, 0.13),
    new THREE.MeshStandardMaterial({ color, roughness: 0.36, metalness: 0.04 })
  );
  body.castShadow = true; body.receiveShadow = true;
  doorMeshGroup.add(body);

  const insetPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 2.55, 0.024),
    new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.01 })
  );
  insetPanel.position.z = 0.076; doorMeshGroup.add(insetPanel);

  [[0.5], [-0.4]].forEach(([py]) => {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.024, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.1 })
    );
    line.position.set(0, py, 0.082); doorMeshGroup.add(line);
  });

  const handlePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.34, 0.025),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.4, metalness: 0.18 })
  );
  handlePlate.position.set(0.39, -0.06, 0.082); doorMeshGroup.add(handlePlate);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.28, 0.045),
    new THREE.MeshStandardMaterial({ color: 0xf4f0e4, roughness: 0.18, metalness: 0.22 })
  );
  handle.position.set(0.39, -0.06, 0.1); doorMeshGroup.add(handle);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a1408, transparent: true, opacity: 0.12, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0.56, 0.001, 0.2); pivot.add(shadow);

  group.userData.pivot = pivot;
  group.userData.doorMeshGroup = doorMeshGroup;
  group.position.set(x, y, z);
  scene.add(group);
  return group;
}

const doors = [
  createDoor({ color: 0xb52828, x: -3.0, name: 'memory'     }),
  createDoor({ color: 0x3c72b8, x: -1.0, name: 'pattern'    }),
  createDoor({ color: 0x2a6638, x:  1.0, name: 'resistance' }),
  createDoor({ color: 0x8a6e1a, x:  3.0, name: 'discomfort' }),
];

/* ─────────────────────────────────────────────
   PLAQUES  (above each door, on back wall)
───────────────────────────────────────────── */
const plaques = [];
const plaqueMeshes = []; // for raycasting

const doorInfo = {
  memory:     { title: 'Memory',     desc: 'What do you keep returning to, even when you tell yourself it\'s over?' },
  pattern:    { title: 'Pattern',    desc: 'When did you first notice this pattern repeating?' },
  resistance: { title: 'Resistance', desc: 'What are you protecting yourself from?' },
  discomfort: { title: 'Discomfort', desc: 'What feels difficult to admit?' },
};

doors.forEach(door => {
  const name = door.userData.name;
  const tex  = makePlaqueTexture(plaqueDrawFns[name], doorColors3[name]);

  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.72, 0.04),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.0 })
  );
  plaque.position.set(door.position.x, door.position.y + 2.55, -6.82);
  plaque.castShadow = true;
  plaque.userData.type  = 'plaque';
  plaque.userData.name  = name;
  plaque.userData.title = doorInfo[name].title;
  plaque.userData.desc  = doorInfo[name].desc;
  plaque.userData.door  = door;
  scene.add(plaque);
  plaques.push(plaque);
  plaqueMeshes.push(plaque);
});

/* ─────────────────────────────────────────────
   ROUND TABLE  (center-foreground)
───────────────────────────────────────────── */
const tableMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc2, roughness: 0.78 });
const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.05, 0.1, 48), tableMat);
tableTop.position.set(0, 0.72, 1.4);
tableTop.castShadow = true; tableTop.receiveShadow = true;
tableTop.userData.type  = 'table';
tableTop.userData.title = 'Reflective Rooms';
tableTop.userData.desc  = 'A self-guided space built around four emotional states. There is no fixed order. Begin anywhere.';
scene.add(tableTop);

const tableStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.6, 16), tableMat);
tableStem.position.set(0, 0.38, 1.4);
tableStem.castShadow = true; scene.add(tableStem);

const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), tableMat);
tableBase.position.set(0, 0.06, 1.4);
tableBase.receiveShadow = true; scene.add(tableBase);

// Woven rug under table
const rugMat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.98, side: THREE.DoubleSide });
const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), rugMat);
rug.rotation.x = -Math.PI / 2;
rug.position.set(0, 0.005, 1.4);
rug.receiveShadow = true;
rug.userData.type  = 'rug';
rug.userData.title = 'Self-guided';
rug.userData.desc  = 'No scores, no prompts, no fixed path. Only you and whatever you choose to bring.';
scene.add(rug);

/* ─────────────────────────────────────────────
   PLANTS
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   PLANT LEFT — Large bushy ficus, left corner,
   tall and full like the reference left plant
───────────────────────────────────────────── */
function createFicusPlant(x, z, scale, discoveryTitle, discoveryDesc) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.type  = 'plant';
  group.userData.title = discoveryTitle;
  group.userData.desc  = discoveryDesc;

  // Large textured pot — round, chunky
  const potMat = new THREE.MeshStandardMaterial({ color: 0xd4cfc4, roughness: 0.80 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.50 * scale, 0.38 * scale, 0.72 * scale, 28), potMat);
  pot.position.y = 0.36 * scale; pot.castShadow = true; pot.receiveShadow = true; group.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.51 * scale, 0.04 * scale, 8, 32), potMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.73 * scale; group.add(rim);

  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.48 * scale, 32),
    new THREE.MeshStandardMaterial({ color: 0x3c2e1e, roughness: 1.0 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.725 * scale; group.add(soil);

  // Short multi-stem trunk (ficus style — splits low)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5240, roughness: 0.92 });
  [[0, 0], [-0.12, 0.08], [0.10, -0.06]].forEach(([ox, oz], i) => {
    const h = (1.4 + i * 0.15) * scale;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.07 * scale, h, 7), trunkMat);
    stem.position.set(ox * scale, 0.725 * scale + h * 0.5, oz * scale);
    stem.castShadow = true; group.add(stem);
  });

  // Dense layered foliage — dark rich greens, many clusters, spread wide
  const f1 = new THREE.MeshStandardMaterial({ color: 0x2d5e35, roughness: 0.88 });
  const f2 = new THREE.MeshStandardMaterial({ color: 0x3a7242, roughness: 0.84 });
  const f3 = new THREE.MeshStandardMaterial({ color: 0x4a8e52, roughness: 0.80 });
  const f4 = new THREE.MeshStandardMaterial({ color: 0x245030, roughness: 0.92 });

  // 14 foliage blobs — wide spread, multiple height layers
  const ficusFoliage = [
    [ 0.00, 2.80,  0.00, 0.80, f2],
    [-0.55, 2.55,  0.22, 0.62, f1],
    [ 0.50, 2.52, -0.18, 0.60, f1],
    [ 0.12, 2.30,  0.38, 0.55, f4],
    [-0.38, 2.28, -0.30, 0.52, f4],
    [ 0.00, 3.05,  0.15, 0.50, f3],
    [-0.62, 2.75, -0.10, 0.46, f2],
    [ 0.58, 2.72,  0.20, 0.44, f3],
    [-0.20, 2.10,  0.25, 0.48, f4],
    [ 0.30, 2.15, -0.25, 0.44, f1],
    [-0.45, 3.00,  0.25, 0.38, f3],
    [ 0.40, 2.95, -0.20, 0.36, f2],
    [ 0.00, 1.90,  0.00, 0.42, f4],
    [-0.65, 2.40,  0.30, 0.35, f3],
  ];
  ficusFoliage.forEach(([lx, ly, lz, lr, mat]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(lr * scale, 11, 8), mat);
    leaf.position.set(lx * scale, ly * scale, lz * scale);
    leaf.castShadow = true; group.add(leaf);
  });

  // Warm green light inside
  const pl = new THREE.PointLight(0xb0e8b0, 0.50, 4.0, 2.0);
  pl.position.set(0, 2.7 * scale, 0); group.add(pl);

  scene.add(group);
  return group;
}

/* ─────────────────────────────────────────────
   PLANT RIGHT — Airy olive/fig tree, closer
   to the right side, sparse and tall like ref
───────────────────────────────────────────── */
function createOlivePlant(x, z, scale, discoveryTitle, discoveryDesc) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.type  = 'plant';
  group.userData.title = discoveryTitle;
  group.userData.desc  = discoveryDesc;

  // Slightly slimmer pot
  const potMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.78 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.32 * scale, 0.65 * scale, 24), potMat);
  pot.position.y = 0.325 * scale; pot.castShadow = true; pot.receiveShadow = true; group.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43 * scale, 0.036 * scale, 8, 28), potMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.66 * scale; group.add(rim);

  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.40 * scale, 28),
    new THREE.MeshStandardMaterial({ color: 0x3c2e1e, roughness: 1.0 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.655 * scale; group.add(soil);

  // Single slender trunk that leans slightly — olive tree style
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a6850, roughness: 0.94 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.038 * scale, 0.065 * scale, 2.2 * scale, 7), trunkMat);
  trunk.position.set(-0.06 * scale, 0.655 * scale + 1.1 * scale, 0);
  trunk.rotation.z = 0.06;
  trunk.castShadow = true; group.add(trunk);

  // Two branch arms splitting near top
  [[0.18, 1.9, 0, 0.5, -0.3], [-0.14, 1.85, 0, 0.45, 0.28]].forEach(([ox, oy, oz, len, angle]) => {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.030 * scale, len * scale, 5), trunkMat);
    branch.position.set(ox * scale, oy * scale, oz * scale);
    branch.rotation.z = angle;
    branch.castShadow = true; group.add(branch);
  });

  // Sparse, airy foliage — lighter greens, smaller gaps between blobs
  const o1 = new THREE.MeshStandardMaterial({ color: 0x4e8858, roughness: 0.80 });
  const o2 = new THREE.MeshStandardMaterial({ color: 0x3c7248, roughness: 0.84 });
  const o3 = new THREE.MeshStandardMaterial({ color: 0x62a86e, roughness: 0.76 });
  const o4 = new THREE.MeshStandardMaterial({ color: 0x2e5e38, roughness: 0.88 });

  // Fewer, airier blobs — spread outward in delicate clusters
  const oliveFoliage = [
    [ 0.00, 3.10,  0.00, 0.52, o1],
    [ 0.42, 2.88,  0.18, 0.42, o3],
    [-0.36, 2.90, -0.14, 0.40, o2],
    [ 0.22, 3.28,  0.10, 0.34, o3],
    [-0.18, 3.25, -0.08, 0.32, o1],
    [ 0.52, 3.05, -0.20, 0.30, o4],
    [-0.50, 3.08,  0.22, 0.30, o2],
    [ 0.10, 2.72,  0.30, 0.36, o4],
    [-0.28, 2.68, -0.28, 0.34, o1],
    [ 0.35, 3.40,  0.05, 0.26, o3],
    [-0.30, 3.42, -0.05, 0.24, o2],
  ];
  oliveFoliage.forEach(([lx, ly, lz, lr, mat]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(lr * scale, 10, 7), mat);
    leaf.position.set(lx * scale, ly * scale, lz * scale);
    leaf.castShadow = true; group.add(leaf);
  });

  // Slightly brighter fill — olive trees feel lighter
  const pl = new THREE.PointLight(0xc0f0b8, 0.45, 3.5, 2.0);
  pl.position.set(0, 3.0 * scale, 0); group.add(pl);

  scene.add(group);
  return group;
}

// Left: large bushy ficus, left side, mid-depth — clearly framing the left edge
const plantLeft  = createFicusPlant(-5.8, 1.8, 1.05,
  'Non-linear',
  'You can begin with any room and move freely between them. There is no correct path.');

// Right: airy olive tree, right side, slightly closer to doors
const plantRight = createOlivePlant(5.4, 1.2, 1.0,
  'Anonymous',
  'Nothing you write is recorded, stored, or shared. This space exists only for you, only now.');

/* ─────────────────────────────────────────────
   INTERACTIVE OBJECT REGISTRY
   All non-door raycasting targets in one list
───────────────────────────────────────────── */
const interactives = [
  ...plaqueMeshes,
  tableTop,
  rug,
  // collect all meshes inside each plant group
  ...plantLeft.children.filter(c => c.isMesh),
  ...plantRight.children.filter(c => c.isMesh),
];
// Tag plant children with parent group data
[plantLeft, plantRight].forEach(plant => {
  plant.children.filter(c => c.isMesh).forEach(c => {
    c.userData.type  = 'plant';
    c.userData.title = plant.userData.title;
    c.userData.desc  = plant.userData.desc;
  });
});

/* ─────────────────────────────────────────────
   INPUT
───────────────────────────────────────────── */
let rawMouseX = 0, rawMouseY = 0;

renderer.domElement.addEventListener('mousemove', (e) => {
  rawMouseX = e.clientX; rawMouseY = e.clientY;

  const rect = renderer.domElement.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                 e.clientY >= rect.top  && e.clientY <= rect.bottom;

  if (!inside && embeddedMode) { mouse.set(-10, -10); return; }

  mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  if (!selectedDoor && !isEntering) {
    const approachNorm     = Math.max(0, (-mouse.y + 0.1) / 1.1);
    targetApproachDepth    = Math.min(1, approachNorm * 1.1);
    const zBase            = APPROACH_FAR_Z + (APPROACH_NEAR_Z - APPROACH_FAR_Z) * targetApproachDepth;
    const tiltScale        = 1 - targetApproachDepth * 0.4;

    targetCameraX  = mouse.x * 0.42 * tiltScale;
    targetCameraY  = 2.18 + mouse.y * 0.08 * tiltScale;
    targetCameraZ  = zBase;
    lookTargetX    = mouse.x * 0.28 * tiltScale;
    lookTargetY    = 2.02 + mouse.y * 0.03 * tiltScale;
    lookTargetZ    = -7.5;
  }

  // Keep tooltip following cursor
  if (tooltipVisible) positionTooltip(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('mouseleave', () => {
  mouse.set(-10, -10);
  targetApproachDepth = 0;
  if (!selectedDoor && !isEntering) resetCameraTargets();
  hideTooltip();
});

renderer.domElement.addEventListener('wheel', (e) => {
  if (isEntering) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.1 : -0.1;
  targetApproachDepth = Math.max(0, Math.min(1, targetApproachDepth + delta));
}, { passive: false });

renderer.domElement.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isEntering) return;

  // Clicking a plaque enters that room
  if (hoveredObject && hoveredObject.userData.type === 'plaque') {
    const door = hoveredObject.userData.door;
    triggerEnterRoom(door);
    return;
  }
  if (!hoveredDoor) return;
  triggerEnterRoom(hoveredDoor);
});

function triggerEnterRoom(door) {
  selectedDoor = door;
  isEntering   = true;
  hideTooltip();

  targetCameraX = door.position.x * 0.55;
  targetCameraY = 1.95;
  targetCameraZ = 5.2;
  lookTargetX   = door.position.x;
  lookTargetY   = 1.95;
  lookTargetZ   = -6.95;
  door.userData.isOpen = true;

  setTimeout(() => { if (fadeOverlay) fadeOverlay.classList.add('active'); }, 70);
  setTimeout(() => {
    if (typeof window.enterFromLanding === 'function') {
      window.enterFromLanding(door.userData.room);
    }
  }, 520);
}

/* ─────────────────────────────────────────────
   HOVER UPDATE  (raycasting — doors + interactives)
───────────────────────────────────────────── */
function updateHover() {
  if (isEntering) return;

  raycaster.setFromCamera(mouse, camera);

  // Check interactives first (plaques, table, plants)
  const hitInteractive = raycaster.intersectObjects(interactives, false);
  if (hitInteractive.length > 0) {
    const obj = hitInteractive[0].object;
    if (obj !== hoveredObject) {
      hoveredObject = obj;
      showTooltip(obj.userData.title, obj.userData.desc, rawMouseX, rawMouseY);
    }
    hoveredDoor = null;
    renderer.domElement.style.cursor = obj.userData.type === 'plaque' ? 'pointer' : 'default';
    return;
  }

  // Check doors
  const hitDoors = raycaster.intersectObjects(doors, true);
  if (hitDoors.length > 0) {
    let found = hitDoors[0].object;
    while (found && !doors.includes(found)) found = found.parent;
    if (found !== hoveredDoor) {
      hoveredDoor = found || null;
      if (hoveredDoor) {
        const info = doorInfo[hoveredDoor.userData.name];
        showTooltip(info.title, info.desc, rawMouseX, rawMouseY);
      }
    }
    hoveredObject = null;
    renderer.domElement.style.cursor = 'pointer';
    return;
  }

  // Nothing hovered
  if (hoveredDoor || hoveredObject) hideTooltip();
  hoveredDoor = null;
  hoveredObject = null;
  renderer.domElement.style.cursor = 'default';
}

/* ─────────────────────────────────────────────
   PLAQUE HOVER ANIMATION
───────────────────────────────────────────── */
function animatePlaques() {
  for (const p of plaques) {
    const isHovered = (p === hoveredObject);
    const targetY   = p.userData.door.position.y + 2.55 + (isHovered ? 0.04 : 0);
    p.position.y   += (targetY - p.position.y) * 0.12;
    const targetScale = isHovered ? 1.06 : 1;
    p.scale.x += (targetScale - p.scale.x) * 0.12;
    p.scale.y += (targetScale - p.scale.y) * 0.12;
  }
}

/* ─────────────────────────────────────────────
   DOOR ANIMATION
───────────────────────────────────────────── */
function animateDoors() {
  for (const door of doors) {
    const isHov = door === hoveredDoor && !isEntering;
    const hoverScale = isHov ? 1.018 : 1;
    door.scale.x += (hoverScale - door.scale.x) * 0.14;
    door.scale.y += (hoverScale - door.scale.y) * 0.14;
    door.scale.z += (hoverScale - door.scale.z) * 0.14;

    if (door.userData.isOpen) {
      door.userData.openProgress += (1 - door.userData.openProgress) * 0.1;
    } else {
      door.userData.openProgress += (0 - door.userData.openProgress) * 0.1;
    }
    door.userData.pivot.rotation.y = -door.userData.openProgress * 1.05;
  }
}

/* ─────────────────────────────────────────────
   LIGHT FLICKER
───────────────────────────────────────────── */
let flickerT = 0;
function updateLightFlicker(dt) {
  flickerT += dt * 0.9;
  ceilingLight.intensity  = 3.2 * (1 + Math.sin(flickerT * 2.3) * 0.012 + Math.sin(flickerT * 5.7) * 0.006);
  ceilingLight2.intensity = 2.0 * (1 + Math.sin(flickerT * 1.7) * 0.008);
}

/* ─────────────────────────────────────────────
   ANIMATE LOOP
───────────────────────────────────────────── */
let lastTime = 0;
function animate(time = 0) {
  requestAnimationFrame(animate);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  approachDepth += (targetApproachDepth - approachDepth) * 0.055;

  camera.position.x += (targetCameraX - camera.position.x) * 0.06;
  camera.position.y += (targetCameraY - camera.position.y) * 0.06;
  camera.position.z += (targetCameraZ - camera.position.z) * 0.06;

  targetLook.set(lookTargetX, lookTargetY, lookTargetZ);
  currentLook.lerp(targetLook, 0.08);
  camera.lookAt(currentLook);

  updateHover();
  animateDoors();
  animatePlaques();
  updateLightFlicker(dt);

  renderer.render(scene, camera);
}
animate();

/* ─────────────────────────────────────────────
   RESIZE
───────────────────────────────────────────── */
window.addEventListener('resize', () => {
  camera.aspect = viewportWidth() / Math.max(viewportHeight(), 1);
  camera.updateProjectionMatrix();
  renderer.setSize(viewportWidth(), viewportHeight());
});