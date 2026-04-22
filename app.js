const body = document.body;
const camera = document.getElementById("camera");
const navLinks = document.querySelectorAll(".nav-link");
const rooms = document.querySelectorAll(".room");
const submitButtons = document.querySelectorAll(".submit-btn");
const clearButtons = document.querySelectorAll(".clear-btn");
const returnCards = document.querySelectorAll(".return-card");
const presenceBtn = document.getElementById("presenceBtn");
const presenceToggles = document.querySelectorAll(".presence-toggle");
const clearAllBtn = document.getElementById("clearAllBtn");

const notebookShell = document.getElementById("notebookShell");
const notebookStage = document.getElementById("notebookStage");
const notebookObject = document.getElementById("notebookObject");
const notebookLeftPage = document.getElementById("notebookLeftPage");
const notebookRightPage = document.getElementById("notebookRightPage");
const notebookWritingLeft = document.getElementById("notebookWritingLeft");
const notebookWritingRight = document.getElementById("notebookWritingRight");
const notebookPageIndicator = document.getElementById("notebookPageIndicator");
const pageTurnOverlay = document.getElementById("pageTurnOverlay");
const roomInputs = document.querySelectorAll(".room-input");

const landing = document.getElementById("landing");
const howBtn = document.getElementById("howBtn");
const howPanel = document.getElementById("howPanel");
const howClose = document.getElementById("howClose");
const howOverlay = document.getElementById("howOverlay");
const homeLink = document.getElementById("homeLink");
const fadeOverlay = document.getElementById("fade-overlay");

let streamActive = false;
let notebookRotation = 0;
let dragStartX = 0;
let dragStartRotation = 0;
let draggingNotebook = false;
let dragMoved = false;
let landingHidden = false;

/* ═══════════════════════════════════════════════════
   BEHAVIORAL TRACKING. portrait generation
   Tracks how the user moves through the space.
   Never reads content. only behavior signals.
═══════════════════════════════════════════════════ */
const ROOMS = ['memory', 'pattern', 'resistance', 'discomfort'];

const sessionData = {
  entryOrder:    [],        // rooms visited in order, first visit only
  timeSpent:     { memory: 0, pattern: 0, resistance: 0, discomfort: 0 },
  wordCount:     { memory: 0, pattern: 0, resistance: 0, discomfort: 0 },
  keystrokeGaps: { memory: [], pattern: [], resistance: [], discomfort: [] },
  returnVisits:  { memory: 0, pattern: 0, resistance: 0, discomfort: 0 },
  visitCount:    { memory: 0, pattern: 0, resistance: 0, discomfort: 0 },
};

let _trackCurrentRoom = null;
let _trackRoomStart   = null;
let _trackLastKey     = null;

function trackEnterRoom(roomName) {
  if (!ROOMS.includes(roomName)) return;

  // Log entry order (first visit only)
  if (!sessionData.entryOrder.includes(roomName)) {
    sessionData.entryOrder.push(roomName);
  }

  sessionData.visitCount[roomName]++;
  if (sessionData.visitCount[roomName] > 1) {
    sessionData.returnVisits[roomName]++;
  }

  _trackCurrentRoom = roomName;
  _trackRoomStart   = Date.now();
  _trackLastKey     = null;
}

function trackLeaveRoom(roomName) {
  if (!ROOMS.includes(roomName) || !_trackRoomStart) return;
  const elapsed = (Date.now() - _trackRoomStart) / 1000;
  sessionData.timeSpent[roomName] += elapsed;
  _trackRoomStart = null;
}

function trackKeystroke(roomName) {
  if (!ROOMS.includes(roomName)) return;
  const now = Date.now();
  if (_trackLastKey !== null) {
    const gap = now - _trackLastKey;
    if (gap > 50 && gap < 3000) { // ignore held keys and long pauses
      sessionData.keystrokeGaps[roomName].push(gap);
    }
  }
  _trackLastKey = now;

  // Update word count from current input
  const room  = document.getElementById(roomName);
  const input = room ? room.querySelector('.room-input') : null;
  if (input) {
    const words = input.value.trim().split(/\s+/).filter(w => w.length > 0).length;
    sessionData.wordCount[roomName] = Math.max(sessionData.wordCount[roomName], words);
  }
}

function roomsVisited() {
  return sessionData.entryOrder.length;
}

const notebookPages = {
  memory: [""],
  pattern: [""],
  resistance: [""],
  discomfort: [""]
};

const currentNotebookPage = {
  memory: 0,
  pattern: 0,
  resistance: 0,
  discomfort: 0
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getCurrentRoomName() {
  const activeRoom = document.querySelector(".room.active");
  return activeRoom ? activeRoom.id : "memory";
}

function updatePresenceButtons(isOn) {
  const text = isOn ? "Hide Presence" : "Show Presence";
  if (presenceBtn) presenceBtn.textContent = text;
  presenceToggles.forEach(btn => {
    btn.textContent = text;
  });
}

function setNotebookRotation(angle) {
  notebookRotation = clamp(angle, -125, 125);
  if (notebookObject) {
    notebookObject.style.setProperty("--notebook-rotate", `${notebookRotation}deg`);
  }
}

function centerNotebook() {
  setNotebookRotation(0);
}

function notebookIsOpen() {
  return Math.abs(notebookRotation) < 55;
}

function updateNotebookIndicator() {
  const roomName = getCurrentRoomName();
  if (roomName === "continuation" || roomName === "about") return;
  if (!notebookPageIndicator) return;

  const pageIndex = currentNotebookPage[roomName] || 0;
  notebookPageIndicator.textContent = `Page ${pageIndex + 1}-${pageIndex + 2}`;
}

function showLandingMode() {
  body.className = "";
  body.classList.add("landing-mode");
  landingHidden = false;

  if (landing) landing.classList.add("active");
  rooms.forEach(room => room.classList.remove("active"));

  if (notebookShell) notebookShell.style.display = "none";
  if (camera) camera.classList.remove("visible");
  if (fadeOverlay) fadeOverlay.classList.remove("active");
  if (typeof window.resetLandingScene === "function") window.resetLandingScene();
}

function hideLandingMode() {
  body.classList.remove("landing-mode");
  landingHidden = true;
}

function openHowPanel() {
  if (howPanel) {
    howPanel.classList.add("open");
    howPanel.setAttribute("aria-hidden", "false");
  }
  if (howOverlay) howOverlay.classList.add("open");
}

function closeHowPanel() {
  if (howPanel) {
    howPanel.classList.remove("open");
    howPanel.setAttribute("aria-hidden", "true");
  }
  if (howOverlay) howOverlay.classList.remove("open");
}

function returnToLanding() {
  rooms.forEach(room => room.classList.remove("active"));
  closeHowPanel();
  body.className = "";
  body.classList.add("landing-mode");
  landingHidden = false;

  if (landing) landing.classList.add("active");
  if (notebookShell) notebookShell.style.display = "none";
  if (camera) camera.classList.remove("visible");
  if (fadeOverlay) fadeOverlay.classList.remove("active");
  if (typeof window.resetLandingScene === "function") window.resetLandingScene();
}

function goHomeSmooth() {
  body.classList.add("fade-out");
  setTimeout(() => {
    returnToLanding();
    body.classList.remove("fade-out");
  }, 300);
}

function setRoom(roomName) {
  // Track leaving the previous room
  if (_trackCurrentRoom) trackLeaveRoom(_trackCurrentRoom);

  rooms.forEach(room => {
    room.classList.toggle("active", room.id === roomName);
  });

  navLinks.forEach(link => {
    link.classList.toggle("active", link.dataset.room === roomName);
  });

  body.className = "";
  body.classList.add(`${roomName}-room`);

  // Reset dot drift counter when entering pattern room
  if (roomName === 'pattern') dotBurstCount = 0;

  // Track entering new room
  trackEnterRoom(roomName);

  if (landing) landing.classList.remove("active");
  landingHidden = true;

  const blackRoom = roomName === "continuation" || roomName === "about";
  if (blackRoom) {
    if (camera) camera.classList.remove("visible");
    if (notebookShell) notebookShell.style.display = "none";
  } else {
    if (notebookShell) notebookShell.style.display = "block";
    if (streamActive && camera) {
      camera.classList.add("visible");
      body.classList.add("camera-on");
    }
  }

  updateNotebook();
  updateNotebookIndicator();
  centerNotebook();
}

function enterFromLanding(roomName) {
  closeHowPanel();

  if (!document.getElementById(roomName)) {
    console.warn(`Missing room: ${roomName}`);
    return;
  }

  setTimeout(() => {
    hideLandingMode();
    setRoom(roomName);
    setTimeout(() => {
      if (fadeOverlay) fadeOverlay.classList.remove("active");
    }, 220);
  }, 120);
}

window.enterFromLanding = enterFromLanding;
window.setRoom = setRoom;
window.returnToLanding = returnToLanding;

async function enableCamera() {
  if (streamActive) {
    if (camera) camera.classList.add("visible");
    body.classList.add("camera-on");
    updatePresenceButtons(true);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    camera.srcObject = stream;
    streamActive = true;
    body.classList.add("camera-on");

    if (!body.classList.contains("continuation-room") && !body.classList.contains("about-room")) {
      camera.classList.add("visible");
    }

    updatePresenceButtons(true);
  } catch (error) {
    alert("Camera access blocked or unavailable.");
  }
}

function disableCamera() {
  if (camera && camera.srcObject) {
    camera.srcObject.getTracks().forEach(track => track.stop());
  }

  if (camera) {
    camera.srcObject = null;
    camera.classList.remove("visible");
  }

  streamActive = false;
  body.classList.remove("camera-on");
  updatePresenceButtons(false);
}

function toggleCamera() {
  if (streamActive) disableCamera();
  else enableCamera();
}

function playFlipSound(direction = "forward") {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;
  const duration = 0.28;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    const t = i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.35) * 0.55;
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(direction === "forward" ? 1350 : 1150, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.36, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}

function updateNotebook() {
  const roomName = getCurrentRoomName();
  if (roomName === "continuation" || roomName === "about") return;
  if (!notebookWritingLeft || !notebookWritingRight) return;

  const pages = notebookPages[roomName];
  const pageIndex = currentNotebookPage[roomName];

  notebookWritingLeft.textContent = pages[pageIndex] || "";
  notebookWritingRight.textContent = pages[pageIndex + 1] || "";

  const activeRoom = document.querySelector(".room.active");
  const activeInput = activeRoom ? activeRoom.querySelector(".room-input") : null;
  if (activeInput) activeInput.value = pages[pageIndex] || "";

  updateNotebookIndicator();
}

function animatePageTurn(direction) {
  if (!pageTurnOverlay) return;
  pageTurnOverlay.classList.remove("flip-forward", "flip-backward");
  void pageTurnOverlay.offsetWidth;
  pageTurnOverlay.classList.add(direction === "forward" ? "flip-forward" : "flip-backward");
}

function flipForward() {
  const roomName = getCurrentRoomName();
  if (roomName === "continuation" || roomName === "about") return;
  if (!notebookIsOpen()) return;

  const activeRoom = document.querySelector(".room.active");
  const activeInput = activeRoom ? activeRoom.querySelector(".room-input") : null;
  if (!activeInput) return;

  notebookPages[roomName][currentNotebookPage[roomName]] = activeInput.value;
  currentNotebookPage[roomName] += 1;

  if (typeof notebookPages[roomName][currentNotebookPage[roomName]] !== "string") {
    notebookPages[roomName][currentNotebookPage[roomName]] = "";
  }

  if (typeof notebookPages[roomName][currentNotebookPage[roomName] + 1] !== "string") {
    notebookPages[roomName][currentNotebookPage[roomName] + 1] = "";
  }

  animatePageTurn("forward");
  playFlipSound("forward");
  updateNotebook();
}

function flipBackward() {
  const roomName = getCurrentRoomName();
  if (roomName === "continuation" || roomName === "about") return;
  if (currentNotebookPage[roomName] === 0) return;
  if (!notebookIsOpen()) return;

  const activeRoom = document.querySelector(".room.active");
  const activeInput = activeRoom ? activeRoom.querySelector(".room-input") : null;
  if (!activeInput) return;

  notebookPages[roomName][currentNotebookPage[roomName]] = activeInput.value;
  currentNotebookPage[roomName] -= 1;

  animatePageTurn("backward");
  playFlipSound("backward");
  updateNotebook();
}

function startNotebookDrag(event) {
  draggingNotebook = true;
  dragMoved = false;
  if (notebookStage) notebookStage.classList.add("dragging");
  dragStartX = event.clientX || 0;
  dragStartRotation = notebookRotation;
}

function moveNotebookDrag(event) {
  if (!draggingNotebook) return;
  const currentX = event.clientX || dragStartX;
  const delta = currentX - dragStartX;
  if (Math.abs(delta) > 6) dragMoved = true;
  setNotebookRotation(dragStartRotation + delta * 0.35);
}

function endNotebookDrag() {
  if (!draggingNotebook) return;
  draggingNotebook = false;
  if (notebookStage) notebookStage.classList.remove("dragging");

  if (Math.abs(notebookRotation) < 28) centerNotebook();
  else if (notebookRotation > 28) setNotebookRotation(118);
  else setNotebookRotation(-118);

  setTimeout(() => {
    dragMoved = false;
  }, 20);
}

navLinks.forEach(link => {
  link.addEventListener("click", () => {
    if (link.id === "homeLink") return;
    if (!link.dataset.room) return;
    setRoom(link.dataset.room);
  });
});

returnCards.forEach(card => {
  card.addEventListener("click", () => setRoom(card.dataset.room));
});

if (howBtn) howBtn.addEventListener("click", openHowPanel);
if (howClose) howClose.addEventListener("click", closeHowPanel);
if (howOverlay) howOverlay.addEventListener("click", closeHowPanel);
if (homeLink) homeLink.addEventListener("click", goHomeSmooth);
if (presenceBtn) presenceBtn.addEventListener("click", toggleCamera);

presenceToggles.forEach(btn => {
  btn.addEventListener("click", toggleCamera);
});

if (notebookLeftPage) {
  notebookLeftPage.addEventListener("click", () => {
    if (!dragMoved) flipBackward();
  });
}

if (notebookRightPage) {
  notebookRightPage.addEventListener("click", () => {
    if (!dragMoved) flipForward();
  });
}

if (notebookStage) {
  notebookStage.addEventListener("pointerdown", startNotebookDrag);
  window.addEventListener("pointermove", moveNotebookDrag);
  window.addEventListener("pointerup", endNotebookDrag);
  window.addEventListener("pointercancel", endNotebookDrag);
}

let isAutoAdvancing = false;

/* ── Ripple field: a fixed container that holds transient ripple elements ── */
function ensureRippleField() {
  let field = document.querySelector('.memory-ripple-field');
  if (!field) {
    field = document.createElement('div');
    field.className = 'memory-ripple-field';
    document.body.appendChild(field);
  }
  return field;
}

function ensurePatternField() {
  let field = document.querySelector('.pattern-dot-field');
  if (!field) {
    field = document.createElement('div');
    field.className = 'pattern-dot-field';
    document.body.appendChild(field);
  }
  return field;
}

/* ── Grain overlay ── */
function ensureGrainLayer() {
  if (!document.querySelector('.grain-layer')) {
    const g = document.createElement('div');
    g.className = 'grain-layer';
    document.body.appendChild(g);
  }
}

let lastRippleTime = 0;
function emitRipple(fromInput) {
  // Only emit in rooms that have the ripple visual
  if (!body.classList.contains('memory-room')) return;

  // Light rate-limit so very fast typing doesn't spam DOM, but slow enough
  // to let multiple ripples overlap on screen at the same time
  const now = performance.now();
  if (now - lastRippleTime < 55) return;
  lastRippleTime = now;

  const field = ensureRippleField();

  // Ripple origin: center of the textarea (where the typing is happening)
  const rect = fromInput.getBoundingClientRect();
  const x = rect.left + rect.width  / 2;
  const y = rect.top  + rect.height / 2;

  const ripple = document.createElement('div');
  ripple.className = 'memory-ripple';
  // Start size is small; CSS animation scales it up massively to travel across the whole room
  const startSize = 24;
  ripple.style.width  = startSize + 'px';
  ripple.style.height = startSize + 'px';
  ripple.style.left   = x + 'px';
  ripple.style.top    = y + 'px';

  // Slight organic variation per ripple
  const duration = 2800 + Math.random() * 900; // 2.8s – 3.7s. long wave travel
  ripple.style.animationDuration = duration + 'ms';

  field.appendChild(ripple);

  // Clean up after animation completes
  setTimeout(() => ripple.remove(), duration + 120);
}

/* ── Pattern room: dot burst on each keystroke ──
   Each keystroke scatters a cluster of dots that fly outward and fade. */
let lastDotTime = 0;
let dotBurstCount = 0;

function emitPatternDots(fromInput) {
  if (!body.classList.contains('pattern-room')) return;

  const now = performance.now();
  if (now - lastDotTime < 35) return;
  lastDotTime = now;
  dotBurstCount++;

  const field = ensurePatternField();
  const rect  = fromInput.getBoundingClientRect();
  const basex = rect.left + rect.width  / 2;
  const basey = rect.top  + rect.height / 2;

  // Progressive drift: each burst nudges origin outward across the screen
  const drift      = Math.min(dotBurstCount * 8, 420);
  const driftAngle = dotBurstCount * 0.38;
  const ox = basex + Math.cos(driftAngle) * drift * 0.55;
  const oy = basey + Math.sin(driftAngle * 0.7) * drift * 0.35;

  // Clamp to viewport
  const cx = Math.max(80, Math.min(window.innerWidth  - 80, ox));
  const cy = Math.max(80, Math.min(window.innerHeight - 80, oy));

  function spawnDot(originX, originY, minDist, maxDist, minSize, maxSize, minDur, maxDur) {
    const dot      = document.createElement('div');
    dot.className  = 'pattern-dot';
    const angle    = Math.random() * Math.PI * 2;
    const distance = minDist + Math.random() * (maxDist - minDist);
    const size     = minSize + Math.random() * (maxSize - minSize);
    const duration = minDur  + Math.random() * (maxDur  - minDur);
    const delay    = Math.random() * 120;
    dot.style.cssText = `
      left: ${originX}px; top: ${originY}px;
      width: ${size}px; height: ${size}px;
      --tx: ${Math.cos(angle) * distance}px;
      --ty: ${Math.sin(angle) * distance}px;
      animation-duration: ${duration}ms;
      animation-delay: ${delay}ms;
    `;
    field.appendChild(dot);
    setTimeout(() => dot.remove(), duration + delay + 80);
  }

  // Wave 1. tight cluster from drifted origin
  const count1 = 10 + Math.floor(Math.random() * 7);
  for (let i = 0; i < count1; i++) {
    spawnDot(cx, cy, 180, 700, 4, 15, 2800, 4800);
  }

  // Wave 2. wider scatter from offset origin, travels further toward screen edges
  const count2 = 5 + Math.floor(Math.random() * 4);
  const w2x = cx + (Math.random() - 0.5) * 200;
  const w2y = cy + (Math.random() - 0.5) * 200;
  for (let i = 0; i < count2; i++) {
    spawnDot(w2x, w2y, 400, 1100, 2, 8, 3200, 5400);
  }
}

ensureGrainLayer();

/* ═══════════════════════════════════════════════════
   RESISTANCE ROOM. organic tension web
   Nodes (circles) appear on each keystroke.
   They connect to nearby nodes with curved tension lines.
   The whole web breathes and drifts while you type.
═══════════════════════════════════════════════════ */
let resistanceCanvas = null;
let resistanceCtx    = null;
let resistanceNodes  = [];   // { x, y, r, vx, vy, age, maxAge }
let resistanceRAF    = null;
let lastResistanceTime = 0;

function ensureResistanceCanvas() {
  if (resistanceCanvas) return;
  resistanceCanvas = document.createElement('canvas');
  resistanceCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.8s ease;
  `;
  document.body.appendChild(resistanceCanvas);
  resistanceCtx = resistanceCanvas.getContext('2d');
  resizeResistanceCanvas();
  window.addEventListener('resize', resizeResistanceCanvas);
}

function resizeResistanceCanvas() {
  if (!resistanceCanvas) return;
  resistanceCanvas.width  = window.innerWidth;
  resistanceCanvas.height = window.innerHeight;
}

function spawnResistanceNode(fromInput) {
  if (!body.classList.contains('resistance-room')) return;

  // Faster spawn rate so web builds quickly
  const now = performance.now();
  if (now - lastResistanceTime < 28) return;
  lastResistanceTime = now;

  ensureResistanceCanvas();
  resistanceCanvas.style.opacity = '1';

  const rect = fromInput.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;

  // Spread grows faster and reaches the whole viewport
  const spread = Math.min(resistanceNodes.length * 22, window.innerWidth * 0.72);
  const angle  = Math.random() * Math.PI * 2;
  const dist   = 30 + Math.random() * Math.max(spread, 120);

  const x = Math.max(50, Math.min(window.innerWidth  - 50, cx + Math.cos(angle) * dist));
  const y = Math.max(50, Math.min(window.innerHeight - 50, cy + Math.sin(angle) * dist));

  resistanceNodes.push({
    x, y,
    r:   30 + Math.random() * 50,        // larger circles: 30–80px
    vx:  (Math.random() - 0.5) * 0.18,
    vy:  (Math.random() - 0.5) * 0.18,
    age: 0,
    maxAge: 700 + Math.random() * 600,   // lives longer: 700–1300 frames
    satellites: Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => ({
      // more satellites: 3–6 per node, larger
      angle: Math.random() * Math.PI * 2,
      dist:  12 + Math.random() * 28,
      rx:    8 + Math.random() * 18,
      ry:    4 + Math.random() * 10,
      rot:   Math.random() * Math.PI,
    }))
  });

  if (!resistanceRAF) drawResistanceWeb();
}

function drawResistanceWeb() {
  if (!resistanceCtx) return;

  const inResistance = body.classList.contains('resistance-room');
  if (!inResistance) {
    if (resistanceCanvas) resistanceCanvas.style.opacity = '0';
    resistanceRAF = null;
    return;
  }

  const W = resistanceCanvas.width;
  const H = resistanceCanvas.height;

  resistanceCtx.clearRect(0, 0, W, H);

  resistanceNodes = resistanceNodes.filter(n => n.age < n.maxAge);
  for (const n of resistanceNodes) {
    n.age++;
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 40 || n.x > W - 40) n.vx *= -1;
    if (n.y < 40 || n.y > H - 40) n.vy *= -1;
  }

  const nodes = resistanceNodes;
  const COLOR  = '245, 240, 225'; // warm cream. high contrast on dark green

  // Tension lines between nodes. wider connection range, thicker strokes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 320;  // wider connection range
      if (dist > maxDist) continue;

      const t  = 1 - dist / maxDist;
      const ao = Math.min(t * 1.0, 0.88)  // high opacity lines
               * Math.min(a.age / 20, 1)
               * Math.min(b.age / 20, 1);

      // Organic arc. more pronounced bow
      const bow = (Math.random() - 0.5) * dist * 0.5;
      const perp = { x: -(b.y - a.y) / dist, y: (b.x - a.x) / dist };
      const mx = (a.x + b.x) / 2 + perp.x * bow;
      const my = (a.y + b.y) / 2 + perp.y * bow;

      resistanceCtx.beginPath();
      resistanceCtx.moveTo(a.x, a.y);
      resistanceCtx.quadraticCurveTo(mx, my, b.x, b.y);
      resistanceCtx.strokeStyle = `rgba(${COLOR}, ${ao})`;
      resistanceCtx.lineWidth   = 1.0 + t * 2.2;  // thicker: up to 3.2px
      resistanceCtx.stroke();

      // Node intersection dot. larger and more visible
      if (dist < 120 && t > 0.5) {
        resistanceCtx.beginPath();
        resistanceCtx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, 3.5, 0, Math.PI * 2);
        resistanceCtx.fillStyle = `rgba(${COLOR}, ${Math.min(ao * 1.6, 0.9)})`;
        resistanceCtx.fill();
      }
    }
  }

  // Draw circles and satellites. stronger, more visible
  for (const n of nodes) {
    const fadeIn  = Math.min(n.age / 20, 1);
    const fadeOut = n.age > n.maxAge - 80 ? (n.maxAge - n.age) / 80 : 1;
    const alpha   = fadeIn * fadeOut * 0.95;  // near-full opacity
    if (alpha <= 0) continue;

    // Main circle. thicker stroke
    resistanceCtx.beginPath();
    resistanceCtx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    resistanceCtx.strokeStyle = `rgba(${COLOR}, ${alpha * 0.95})`;
    resistanceCtx.lineWidth   = 1.8;
    resistanceCtx.stroke();

    // Satellite ovals. larger and more visible
    for (const s of n.satellites) {
      const sx = n.x + Math.cos(s.angle) * (n.r * 0.6 + s.dist);
      const sy = n.y + Math.sin(s.angle) * (n.r * 0.6 + s.dist);
      resistanceCtx.save();
      resistanceCtx.translate(sx, sy);
      resistanceCtx.rotate(s.rot + s.angle);
      resistanceCtx.beginPath();
      resistanceCtx.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2);
      resistanceCtx.strokeStyle = `rgba(${COLOR}, ${alpha * 0.80})`;
      resistanceCtx.lineWidth   = 1.3;
      resistanceCtx.stroke();
      resistanceCtx.restore();
    }

    // Center node dot
    resistanceCtx.beginPath();
    resistanceCtx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
    resistanceCtx.fillStyle = `rgba(${COLOR}, ${alpha})`;
    resistanceCtx.fill();
  }

  resistanceRAF = requestAnimationFrame(drawResistanceWeb);
}

// Reset web when leaving/entering resistance room
/* ═══════════════════════════════════════════════════
   DISCOMFORT ROOM. fracturing crack lines
   A crack network grows from a focal point as you type.
   Each keystroke extends existing cracks and spawns new
   branches. sharp, irregular, spreading like pressure
   building until something breaks.
═══════════════════════════════════════════════════ */
let crackCanvas  = null;
let crackCtx     = null;
let crackRAF     = null;
let crackSegments = []; // { x1,y1, x2,y2, width, opacity, growing, progress, children }
let crackRoots   = [];  // origin points. shift slightly per burst so fracture spreads
let lastCrackTime = 0;
let crackGeneration = 0;

function ensureCrackCanvas() {
  if (crackCanvas) return;
  crackCanvas = document.createElement('canvas');
  crackCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.8s ease;
  `;
  document.body.appendChild(crackCanvas);
  crackCtx = crackCanvas.getContext('2d');
  resizeCrackCanvas();
  window.addEventListener('resize', resizeCrackCanvas);
}

function resizeCrackCanvas() {
  if (!crackCanvas) return;
  crackCanvas.width  = window.innerWidth;
  crackCanvas.height = window.innerHeight;
}

// Recursive crack: grows a jagged line from (x,y) at given angle
// Returns all segments created
function buildCrack(x, y, angle, length, width, depth, segments) {
  if (depth <= 0 || length < 4) return;

  // Jag the direction. cracks aren't straight
  const jag      = (Math.random() - 0.5) * 0.7;
  const newAngle  = angle + jag;
  const segLen    = length * (0.55 + Math.random() * 0.35);

  const x2 = x + Math.cos(newAngle) * segLen;
  const y2 = y + Math.sin(newAngle) * segLen;

  const seg = {
    x1: x, y1: y, x2, y2,
    width,
    drawProgress: 0,      // 0→1 animates the crack drawing in
    speed: 0.06 + Math.random() * 0.06,
    children: [],
    spawned: false,       // children spawn once this segment is mostly drawn
    opacity: 0.82 - (0.06 * (5 - depth)), // deeper = slightly fainter
  };
  segments.push(seg);

  // Branch: each crack may split 1–2 times
  const branches = depth > 2 ? (Math.random() < 0.55 ? 2 : 1) : (Math.random() < 0.3 ? 1 : 0);
  for (let b = 0; b < branches; b++) {
    const branchAngle = newAngle + (Math.random() - 0.5) * 1.1
                      + (b === 1 ? (Math.random() > 0.5 ? 0.5 : -0.5) : 0);
    const branchLen   = (length * 0.45) * (0.7 + Math.random() * 0.4);
    const childSegs   = [];
    buildCrack(x2, y2, branchAngle, branchLen, width * 0.62, depth - 1, childSegs);
    seg.children.push(childSegs);
  }
}

function spawnCrack(fromInput) {
  if (!body.classList.contains('discomfort-room')) return;

  const now = performance.now();
  if (now - lastCrackTime < 60) return;
  lastCrackTime = now;
  crackGeneration++;

  ensureCrackCanvas();
  crackCanvas.style.opacity = '1';

  const rect = fromInput.getBoundingClientRect();
  const basex = rect.left + rect.width  / 2;
  const basey = rect.top  + rect.height / 2;

  // Origin drifts further and faster so cracks cover the whole viewport
  const drift  = Math.min(crackGeneration * 28, window.innerWidth * 0.85);
  const da     = crackGeneration * 0.44;
  const ox = Math.max(60, Math.min(window.innerWidth  - 60, basex + Math.cos(da) * drift * 0.75));
  const oy = Math.max(60, Math.min(window.innerHeight - 60, basey + Math.sin(da * 0.58) * drift * 0.65));
  crackRoots.push({ x: ox, y: oy });

  // Spawn 3–5 primary crack arms, longer reach
  const arms = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < arms; i++) {
    const angle    = (Math.PI * 2 * i / arms) + (Math.random() - 0.5) * 1.0;
    const length   = 160 + Math.random() * 340;
    const segments = [];
    buildCrack(ox, oy, angle, length, 1.8 + Math.random() * 1.4, 6, segments);
    crackSegments.push(...segments);
  }

  if (!crackRAF) drawCracks();
}

function drawCracks() {
  if (!crackCtx) return;

  if (!body.classList.contains('discomfort-room')) {
    if (crackCanvas) crackCanvas.style.opacity = '0';
    crackRAF = null;
    return;
  }

  const W = crackCanvas.width;
  const H = crackCanvas.height;
  crackCtx.clearRect(0, 0, W, H);

  // Animate draw progress for each segment
  for (const seg of crackSegments) {
    if (seg.drawProgress < 1) {
      seg.drawProgress = Math.min(1, seg.drawProgress + seg.speed);
      // Once mostly drawn, unlock children
      if (!seg.spawned && seg.drawProgress > 0.75) {
        seg.spawned = true;
        for (const childArr of seg.children) {
          crackSegments.push(...childArr);
        }
      }
    }
  }

  // Draw all segments. interpolate endpoint for the growing effect
  for (const seg of crackSegments) {
    if (seg.drawProgress <= 0) continue;
    const p  = seg.drawProgress;
    const x2 = seg.x1 + (seg.x2 - seg.x1) * p;
    const y2 = seg.y1 + (seg.y2 - seg.y1) * p;

    crackCtx.beginPath();
    crackCtx.moveTo(seg.x1, seg.y1);

    // Add micro-jitter along each segment for irregular edge feel
    if (p > 0.3 && seg.width > 1.2) {
      const mx = (seg.x1 + x2) / 2 + (Math.random() - 0.5) * seg.width * 1.5;
      const my = (seg.y1 + y2) / 2 + (Math.random() - 0.5) * seg.width * 1.5;
      crackCtx.quadraticCurveTo(mx, my, x2, y2);
    } else {
      crackCtx.lineTo(x2, y2);
    }

    // Color: warm cream-gold on the dark amber discomfort background
    crackCtx.strokeStyle = `rgba(240, 225, 180, ${seg.opacity * p})`;
    crackCtx.lineWidth   = seg.width * p;
    crackCtx.lineCap     = 'round';
    crackCtx.stroke();

    // Dark fill on thick main cracks (the deep void effect from reference)
    if (seg.width > 2.2 && p > 0.5) {
      crackCtx.beginPath();
      crackCtx.moveTo(seg.x1, seg.y1);
      crackCtx.lineTo(x2, y2);
      crackCtx.strokeStyle = `rgba(10, 4, 0, ${(seg.opacity * 0.6) * p})`;
      crackCtx.lineWidth   = seg.width * 0.35 * p;
      crackCtx.stroke();
    }
  }

  // Draw origin stress points
  for (const r of crackRoots) {
    crackCtx.beginPath();
    crackCtx.arc(r.x, r.y, 3, 0, Math.PI * 2);
    crackCtx.fillStyle = 'rgba(240, 225, 180, 0.75)';
    crackCtx.fill();
  }

  crackRAF = requestAnimationFrame(drawCracks);
}

const _origSetRoom = window.setRoom;
window.setRoom = function(roomName) {
  _origSetRoom(roomName);
  if (roomName !== 'resistance') {
    resistanceNodes = [];
    if (resistanceCanvas) resistanceCanvas.style.opacity = '0';
    if (resistanceRAF) { cancelAnimationFrame(resistanceRAF); resistanceRAF = null; }
  }
  if (roomName !== 'discomfort') {
    crackSegments = []; crackRoots = []; crackGeneration = 0;
    if (crackCanvas) crackCanvas.style.opacity = '0';
    if (crackRAF) { cancelAnimationFrame(crackRAF); crackRAF = null; }
  }
};

/* ── Idle fade: effects disappear after 1.2s of no typing ── */
let idleFadeTimer = null;
const IDLE_DELAY  = 1200; // ms after last keystroke before fading out

function showEffects() {
  // Restore opacity for whichever room's canvas is active
  const rippleField  = document.querySelector('.memory-ripple-field');
  const dotField     = document.querySelector('.pattern-dot-field');
  if (rippleField)  rippleField.style.opacity  = '1';
  if (dotField)     dotField.style.opacity     = '1';
  if (resistanceCanvas && body.classList.contains('resistance-room'))
    resistanceCanvas.style.opacity = '1';
  if (crackCanvas && body.classList.contains('discomfort-room'))
    crackCanvas.style.opacity = '1';
}

function scheduleIdleFade() {
  if (idleFadeTimer) clearTimeout(idleFadeTimer);

  idleFadeTimer = setTimeout(() => {
    // Fade all layers out smoothly
    const rippleField = document.querySelector('.memory-ripple-field');
    const dotField    = document.querySelector('.pattern-dot-field');
    if (rippleField)        rippleField.style.opacity       = '0';
    if (dotField)           dotField.style.opacity          = '0';
    if (resistanceCanvas)   resistanceCanvas.style.opacity  = '0';
    if (crackCanvas)        crackCanvas.style.opacity       = '0';

    // After fade completes, clear all data so next session starts fresh
    setTimeout(() => {
      if (rippleField)  rippleField.innerHTML = '';
      if (dotField)     dotField.innerHTML    = '';

      resistanceNodes = [];
      if (resistanceRAF) { cancelAnimationFrame(resistanceRAF); resistanceRAF = null; }
      if (resistanceCtx && resistanceCanvas)
        resistanceCtx.clearRect(0, 0, resistanceCanvas.width, resistanceCanvas.height);

      crackSegments = []; crackRoots = []; crackGeneration = 0;
      if (crackRAF) { cancelAnimationFrame(crackRAF); crackRAF = null; }
      if (crackCtx && crackCanvas)
        crackCtx.clearRect(0, 0, crackCanvas.width, crackCanvas.height);
    }, 900); // wait for CSS opacity transition to finish
  }, IDLE_DELAY);
}

roomInputs.forEach(input => {
  input.addEventListener("input", (e) => {
    if (isAutoAdvancing) return; // prevent re-entrant calls during page flip
    const roomName = input.dataset.room;
    notebookPages[roomName][currentNotebookPage[roomName]] = input.value;
    updateNotebook();

    // Track this keystroke for the portrait
    trackKeystroke(roomName);

    // Emit effect on character insertion (not deletion)
    if (e.inputType && e.inputType.startsWith('insert')) {
      showEffects();           // make sure layers are visible
      emitRipple(input);
      emitPatternDots(input);
      spawnResistanceNode(input);
      spawnCrack(input);
    }

    scheduleIdleFade();        // reset the idle countdown on every keystroke

    // Use rAF so the DOM has painted the updated notebook writing div before we measure
    requestAnimationFrame(() => autoAdvancePage(input, roomName));
  });
});

function autoAdvancePage(input, roomName) {
  if (!notebookWritingLeft || !notebookLeftPage) return;
  if (isAutoAdvancing) return;

  const writingEl  = notebookWritingLeft;
  const pageEl     = notebookLeftPage;
  const pageHeight = pageEl.clientHeight;

  // If text fits, nothing to do
  if (writingEl.scrollHeight <= pageHeight + 4) return;

  const fullText = input.value;
  if (!fullText.trim()) return;

  // Get the computed line height of the writing element
  const cs           = window.getComputedStyle(writingEl);
  const lineHeightPx = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
  const paddingTop   = parseFloat(cs.paddingTop)  || 0;
  const paddingBot   = parseFloat(cs.paddingBottom) || 0;
  const linesPerPage = Math.floor((pageHeight - paddingTop - paddingBot) / lineHeightPx);

  // Build a measuring div that exactly matches the writing element's styles
  const measurer = document.createElement('div');
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    top: -9999px;
    left: -9999px;
    width: ${writingEl.offsetWidth}px;
    font-family: ${cs.fontFamily};
    font-size: ${cs.fontSize};
    font-weight: ${cs.fontWeight};
    line-height: ${cs.lineHeight};
    letter-spacing: ${cs.letterSpacing};
    white-space: pre-wrap;
    word-break: break-word;
    padding: ${cs.padding};
    box-sizing: border-box;
  `;
  document.body.appendChild(measurer);

  // Binary search: find exact char index where text exceeds linesPerPage
  let lo = 0, hi = fullText.length;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    measurer.textContent = fullText.slice(0, mid);
    const renderedLines = Math.round(measurer.scrollHeight / lineHeightPx);
    if (renderedLines <= linesPerPage) lo = mid;
    else hi = mid;
  }
  document.body.removeChild(measurer);

  // Snap to nearest word boundary
  let splitAt = lo;
  const lastSpace   = fullText.lastIndexOf(' ',  lo);
  const lastNewline = fullText.lastIndexOf('\n', lo);
  const wordBound   = Math.max(lastSpace, lastNewline);
  if (wordBound > Math.floor(lo * 0.75)) splitAt = wordBound;

  const pageText  = fullText.slice(0, splitAt).replace(/[ \t]+$/, '');
  const spillText = fullText.slice(splitAt).replace(/^[\s]+/, '');

  if (!pageText || !spillText) return;

  // Lock against re-entry
  isAutoAdvancing = true;

  // Commit split to page data
  notebookPages[roomName][currentNotebookPage[roomName]] = pageText;
  currentNotebookPage[roomName] += 1;

  while (notebookPages[roomName].length <= currentNotebookPage[roomName] + 1) {
    notebookPages[roomName].push('');
  }
  notebookPages[roomName][currentNotebookPage[roomName]] = spillText;

  animatePageTurn('forward');
  playFlipSound('forward');
  updateNotebook(); // this also sets input.value = spillText for the new page

  // Move caret to end of textarea so user keeps typing naturally
  requestAnimationFrame(() => {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
    input.scrollTop = input.scrollHeight;
    isAutoAdvancing = false; // unlock after paint
  });
}

submitButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;

    const value = input.value.trim();
    const roomName = input.dataset.room;
    if (!value) return;

    notebookPages[roomName][currentNotebookPage[roomName]] = value;
    input.value = "";
    updateNotebook();
  });
});

clearButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const roomName = btn.dataset.room;
    notebookPages[roomName] = [""];
    currentNotebookPage[roomName] = 0;

    const room = document.getElementById(roomName);
    const input = room ? room.querySelector(".room-input") : null;
    if (input) input.value = "";

    updateNotebook();
    centerNotebook();
  });
});

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    Object.keys(notebookPages).forEach(key => {
      notebookPages[key] = [""];
      currentNotebookPage[key] = 0;
    });

    roomInputs.forEach(input => {
      input.value = "";
    });

    updateNotebook();
    centerNotebook();
  });
}

/* ═══════════════════════════════════════════════════
   PORTRAIT ENGINE. generates a poetic reflection
   based purely on behavioral signals, not content.
═══════════════════════════════════════════════════ */

const inlineHint = document.getElementById('portraitInlineHint');
const inlineText = document.getElementById('portraitInlineText');

function avgGap(gaps) {
  if (!gaps.length) return null;
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

function generatePortrait() {
  // Capture final time for current room
  if (_trackCurrentRoom) trackLeaveRoom(_trackCurrentRoom);

  const sd = sessionData;
  const rooms = ROOMS.filter(r => sd.entryOrder.includes(r));

  // ── Signals ──────────────────────────────────────
  const first = sd.entryOrder[0];
  const last  = sd.entryOrder[sd.entryOrder.length - 1];

  // Most time / least time
  const byTime    = [...rooms].sort((a,b) => sd.timeSpent[b] - sd.timeSpent[a]);
  const mostTime  = byTime[0];
  const leastTime = byTime[byTime.length - 1];

  // Most words / least words
  const byWords   = [...rooms].sort((a,b) => sd.wordCount[b] - sd.wordCount[a]);
  const mostWords = byWords[0];

  // Typing rhythm: avg gap in ms → low = fast/urgent, high = slow/hesitant
  const rhythms = {};
  rooms.forEach(r => { rhythms[r] = avgGap(sd.keystrokeGaps[r]); });
  const validRhythms = rooms.filter(r => rhythms[r] !== null);
  const slowest = validRhythms.sort((a,b) => rhythms[b] - rhythms[a])[0];
  const fastest = validRhythms.sort((a,b) => rhythms[a] - rhythms[b])[0];

  // Returned to
  const returned = rooms.filter(r => sd.returnVisits[r] > 0);

  // Total words
  const totalWords = rooms.reduce((s, r) => s + sd.wordCount[r], 0);

  // ── Sentence fragments ────────────────────────────
  // Each group has multiple variants so the portrait feels unique each time.

  const roomNames = { memory: 'Memory', pattern: 'Pattern', resistance: 'Resistance', discomfort: 'Discomfort' };

  function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const sentences = [];

  // 1. Entry: which door pulled them first
  const entrySentences = {
    memory:     [
      "Memory was the first place you went.",
      "You moved toward Memory before anywhere else.",
      "Something in Memory called you in first.",
    ],
    pattern:    [
      "You began with Pattern.",
      "Pattern was the first room you entered.",
      "You went to Pattern first. before you knew what was waiting.",
    ],
    resistance: [
      "You walked into Resistance first.",
      "Resistance was where you chose to start.",
      "You didn't avoid Resistance. you went there first.",
    ],
    discomfort: [
      "You opened Discomfort before anything else.",
      "Discomfort was the first room you entered.",
      "You went straight toward Discomfort.",
    ],
  };
  sentences.push(rnd(entrySentences[first]));

  // 2. Where they lingered / where words gathered
  if (mostTime && mostWords && mostTime === mostWords) {
    sentences.push(rnd([
      `${roomNames[mostTime]} held you the longest. and your words gathered there too.`,
      `You lingered in ${roomNames[mostTime]}. It's also where the most came out.`,
      `Something in ${roomNames[mostTime]} kept you. The writing collected there.`,
    ]));
  } else if (mostTime) {
    sentences.push(rnd([
      `You lingered longest in ${roomNames[mostTime]}.`,
      `${roomNames[mostTime]} was where you stayed.`,
      `Time moved differently in ${roomNames[mostTime]}. you were there the longest.`,
    ]));
    if (mostWords && mostWords !== mostTime) {
      sentences.push(rnd([
        `Your words gathered more in ${roomNames[mostWords]}, though.`,
        `But it was ${roomNames[mostWords]} where the writing opened up.`,
        `${roomNames[mostWords]} is where language came more easily.`,
      ]));
    }
  }

  // 3. Rhythm: the texture of how they wrote
  if (slowest && fastest && slowest !== fastest) {
    const rhythmPhrases = {
      memory_slow:     [
        "In Memory, something slowed you. the words arrived carefully, one at a time.",
        "Memory asked more of you. The writing there came slowly.",
        "There was a hesitation in Memory, like something needed to be approached gently.",
      ],
      pattern_slow:    [
        "In Pattern, you paused more between words.",
        "Something in Pattern made the writing slower, more deliberate.",
        "Pattern held you at a different pace. less certain, more searching.",
      ],
      resistance_slow: [
        "Resistance was where your writing slowed the most.",
        "The words in Resistance came out reluctantly.",
        "In Resistance, something made you pause. harder to name, harder to place.",
      ],
      discomfort_slow: [
        "Discomfort asked the most of you. Your writing there was the most careful.",
        "In Discomfort, the words came slowly. like each one cost something.",
        "Your writing slowed deepest in Discomfort.",
      ],
      memory_fast:     [
        "Memory moved quickly under your hands. like something needed to get out.",
        "In Memory, the writing arrived fast, almost urgently.",
        "Something in Memory wanted to be said quickly.",
      ],
      pattern_fast:    [
        "Pattern came out fast. like you already knew what you wanted to say.",
        "In Pattern, you wrote with an urgency that wasn't there elsewhere.",
        "Your writing in Pattern had a momentum to it.",
      ],
      resistance_fast: [
        "Resistance came out faster than you might have expected.",
        "In Resistance, something poured out quickly.",
        "Your writing moved fast in Resistance. maybe more than you planned.",
      ],
      discomfort_fast: [
        "Discomfort moved through you quickly. faster than anywhere else.",
        "In Discomfort, the writing came fast, like something had been waiting.",
        "You wrote through Discomfort quickly.",
      ],
    };
    sentences.push(rnd(rhythmPhrases[`${slowest}_slow`] || [`Something slowed you in ${roomNames[slowest]}.`]));
  }

  // 4. Return: what pulled them back
  if (returned.length > 0) {
    const r = returned[0];
    sentences.push(rnd([
      `You came back to ${roomNames[r]}.`,
      `${roomNames[r]} drew you back. something there wasn't quite finished.`,
      `Of all the rooms, ${roomNames[r]} was the one you returned to.`,
      `You left ${roomNames[r]} and then went back. Something stayed with you.`,
    ]));
  }

  // 5. Where they ended
  if (last !== first && rooms.length > 1) {
    sentences.push(rnd([
      `You ended in ${roomNames[last]}.`,
      `${roomNames[last]} was the last place you were.`,
      `You closed in ${roomNames[last]}.`,
    ]));
  }

  // 6. Volume: closing texture, most poetic
  if (totalWords === 0) {
    sentences.push(rnd([
      "You moved through the rooms without leaving anything behind.",
      "Nothing was written. but you were here, and that's its own kind of presence.",
      "You looked without writing. That says something too.",
    ]));
  } else if (totalWords < 20) {
    sentences.push(rnd([
      "Only a few words made it onto the page. The rest stayed inside.",
      "You wrote carefully. not much, but chosen.",
      "Not everything needed to be said. A few words were enough.",
    ]));
  } else if (totalWords < 60) {
    sentences.push(rnd([
      "Some things found their way onto the page. Others didn't need to.",
      "You wrote enough to say something. not everything, but something.",
      "The writing was measured. Considered.",
    ]));
  } else {
    sentences.push(rnd([
      "A lot came out. Whatever you carried in here, most of it found words.",
      "The pages filled. Something in this space gave you room to say it.",
      "You wrote through it. a lot of it. That takes something.",
    ]));
  }

  return sentences.join(' ');
}

let portraitRendered  = false; // only generate once per session

function renderInlinePortrait() {
  if (!inlineText) return;

  // Force colours directly. overrides any CSS cascade from reflective-rooms.css
  if (inlineText)  inlineText.style.color  = '#0e0a06';
  if (inlineHint)  inlineHint.style.color  = 'rgba(14,10,6,0.42)';
  const anonNote = document.querySelector('.portrait-inline-anon');
  if (anonNote)    anonNote.style.color    = 'rgba(14,10,6,0.28)';
  const roomLabel = document.querySelector('#about .room-label');
  if (roomLabel)   roomLabel.style.color   = 'rgba(14,10,6,0.30)';

  if (roomsVisited() < 2) {
    if (inlineHint) inlineHint.style.display = 'block';
    inlineText.style.display = 'none';
    return;
  }

  if (inlineHint) inlineHint.style.display = 'none';
  inlineText.style.display = 'block';
  inlineText.textContent   = '';

  const text      = generatePortrait();
  portraitRendered = true;

  // Reveal sentences one at a time
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  let i = 0;
  function revealNext() {
    if (i >= sentences.length) return;
    const span = document.createElement('span');
    span.className   = 'portrait-sentence';
    span.textContent = sentences[i].trim() + ' ';
    span.style.color = '#0e0a06';
    inlineText.appendChild(span);
    setTimeout(() => span.classList.add('visible'), 30);
    i++;
    setTimeout(revealNext, 950);
  }
  setTimeout(revealNext, 300);
}

// Trigger portrait when About room is entered. hook into setRoom
const _setRoomBeforePortrait = window.setRoom;
window.setRoom = function(roomName) {
  _setRoomBeforePortrait(roomName);
  if (roomName === 'about') {
    // Force white background directly on the element. bypasses reflective-rooms.css
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.style.background = '#f8f6f2';
      aboutSection.style.color      = '#0e0a06';
    }
    setTimeout(renderInlinePortrait, 200);
  }
};

// Keep overlay close wired up (for any edge case)
if (portraitClose) portraitClose.addEventListener('click', () => {
  if (portraitOverlay) {
    portraitOverlay.classList.remove('active');
    portraitOverlay.setAttribute('aria-hidden', 'true');
  }
});

showLandingMode();
updatePresenceButtons(false);
updateNotebook();
centerNotebook();