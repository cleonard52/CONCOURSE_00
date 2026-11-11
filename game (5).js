// ==========================================
// 1. PERSISTENT SAVE DATA (LOCALSTORAGE)
// ==========================================
const SAVE_KEY = 'babbdi_concourse_save_v1';

const defaultSave = {
  highScore: 0,
  tokens: 0,
  upgrades: {
    strafe: 1,
    jump: 1,
    magnet: 1
  },
  unlockedSkins: ['default'],
  equippedSkin: 'default' // Tracks the active Selected World
};

let saveData = loadSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultSave));
    const parsed = JSON.parse(raw);
    return {
      ...defaultSave,
      ...parsed,
      upgrades: { ...defaultSave.upgrades, ...(parsed.upgrades || {}) }
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(defaultSave));
  }
}

function writeSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
}

// ==========================================
// 2. WEB AUDIO SYNTHESIS (DRONE, COINS, SFX)
// ==========================================
let audioCtx, droneOsc;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  droneOsc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  droneOsc.type = 'sawtooth';
  droneOsc.frequency.value = 42;
  filter.type = 'lowpass';
  filter.frequency.value = 100;
  gain.gain.value = 0.15;

  droneOsc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  droneOsc.start();
}

function playCoinSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, audioCtx.currentTime);
  osc.frequency.setValueAtTime(780, audioCtx.currentTime + 0.06);
  g.gain.setValueAtTime(0.16, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.22);
}

function playJumpSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(215, audioCtx.currentTime + 0.16);
  g.gain.setValueAtTime(0.14, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.16);
}

function playCrashSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(85, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(18, audioCtx.currentTime + 0.45);
  g.gain.setValueAtTime(0.3, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.45);
}

// ==========================================
// 3. PROCEDURAL LO-FI TEXTURE GENERATOR
// ==========================================
function createBrutalistTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (type === 'ground') {
    ctx.fillStyle = '#474b45';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 3600; i++) {
      const shade = 52 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade - 3})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    ctx.fillStyle = 'rgba(20, 22, 19, 0.55)';
    ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 0, 2, 128);
    ctx.fillRect(64, 0, 1, 128);
    ctx.fillRect(0, 64, 128, 1);
  } else if (type === 'building') {
    ctx.fillStyle = '#383b36';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2400; i++) {
      const shade = 40 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade - 2})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    ctx.fillStyle = '#181a17';
    for (let y = 12; y < 120; y += 28) {
      for (let x = 10; x < 120; x += 24) {
        if (Math.random() > 0.22) {
          ctx.fillRect(x, y, 12, 14);
        }
      }
    }
  } else if (type === 'hazard') {
    ctx.fillStyle = '#69552b';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1e201d';
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i - 48, 128);
      ctx.lineTo(i - 64, 128);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// ==========================================
// 4. THREE.JS SCENE, CAMERA & PROGRESSIVE WORLDS
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Core Difficulty Matrix configuring parameters based on world purchase selections
const WORLD_CONFIGS = {
  default: { fog: 0x2b2e29, ambient: 0x959c90, dir: 0xdbe3d5, token: 0xd4b459, bodyClass: '',            speedMult: 1.0,  density: 140, spawnLineCount: 16, scoreMult: 1.0, tokenBonus: 1 },
  sodium:  { fog: 0x3b311e, ambient: 0xb89f6e, dir: 0xffd27d, token: 0xfff099, bodyClass: 'skin-sodium', speedMult: 1.2,  density: 175, spawnLineCount: 24, scoreMult: 1.5, tokenBonus: 2 },
  rust:    { fog: 0x38201d, ambient: 0xa8716b, dir: 0xff9d94, token: 0xffd166, bodyClass: 'skin-rust',   speedMult: 1.45, density: 210, spawnLineCount: 32, scoreMult: 2.0, tokenBonus: 2 },
  void:    { fog: 0x0d120f, ambient: 0x4d735c, dir: 0x8cffb8, token: 0x8cffb8, bodyClass: 'skin-void',   speedMult: 1.75, density: 280, spawnLineCount: 48, scoreMult: 3.0, tokenBonus: 3 }
};

let activeConfig = WORLD_CONFIGS.default;

scene.background = new THREE.Color(WORLD_CONFIGS.default.fog);
scene.fog = new THREE.FogExp2(WORLD_CONFIGS.default.fog, 0.023);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 140);
const EYE_HEIGHT = 1.45;
camera.position.set(0, EYE_HEIGHT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x959c90, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xdbe3d5, 0.65);
dirLight.position.set(15, 35, 12);
scene.add(dirLight);

const groundTex = createBrutalistTexture('ground');
groundTex.repeat.set(60, 60);
const buildingTex = createBrutalistTexture('building');
buildingTex.repeat.set(2, 4);
const hazardTex = createBrutalistTexture('hazard');

const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 });
const buildingMat = new THREE.MeshStandardMaterial({ map: buildingTex, roughness: 0.9 });
const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.85 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4d47, roughness: 0.9 });
const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x222421, roughness: 0.9 });
const figureMat = new THREE.MeshStandardMaterial({ color: 0x161715, roughness: 1.0 });
const lightBulbMat = new THREE.MeshBasicMaterial({ color: 0xe3ebd5 });
const trainWindowMat = new THREE.MeshBasicMaterial({ color: 0xc9d4b8 });
const tokenMat = new THREE.MeshStandardMaterial({
  color: 0xd4b459,
  emissive: 0x594716,
  roughness: 0.35,
  metalness: 0.6
});

function applyWorldSettings(skinId) {
  activeConfig = WORLD_CONFIGS[skinId] || WORLD_CONFIGS.default;
  scene.background.setHex(activeConfig.fog);
  scene.fog.color.setHex(activeConfig.fog);
  ambientLight.color.setHex(activeConfig.ambient);
  dirLight.color.setHex(activeConfig.dir);
  tokenMat.color.setHex(activeConfig.token);
  document.body.className = activeConfig.bodyClass;
}

const groundGeo = new THREE.PlaneGeometry(340, 340);
groundGeo.rotateX(-Math.PI / 2);
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
scene.add(groundMesh);

// ==========================================
// 5. OBJECT & WORLD SPAWNERS
// ==========================================
const LOOP_WIDTH = 180;
const HALF_LOOP = LOOP_WIDTH / 2;
const Z_DEPTH = 140;

let props = [];
let coins = [];
let monorailTrains = [];

function wrapX(val) {
  let wrapped = (val + HALF_LOOP) % LOOP_WIDTH;
  if (wrapped < 0) wrapped += LOOP_WIDTH;
  return wrapped - HALF_LOOP;
}

function createBystanderSilhouette() {
  const fig = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.32), figureMat);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.32), figureMat);
  head.position.y = 1.98;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.28), figureMat);
  legs.position.y = 0.32;
  fig.add(torso, head, legs);
  return fig;
}

function createConcreteUtilityPole() {
  const poleGroup = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 11, 8), poleMat);
  shaft.position.y = 5.5;
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.22), darkMetalMat);
  crossbar.position.y = 9.8;
  const ins1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.18), lightBulbMat);
  ins1.position.set(-0.95, 10.05, 0);
  const ins2 = ins1.clone();
  ins2.position.set(0.95, 10.05, 0);

  poleGroup.add(shaft, crossbar, ins1, ins2);
  return poleGroup;
}

function createProp(x, z) {
  const roll = Math.random();
  let mesh;

  if (roll < 0.24) {
    const w = 5 + Math.random() * 8;
    const d = 5 + Math.random() * 8;
    const h = 18 + Math.random() * 28;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
    mesh.position.y = h / 2;
    mesh.userData = { halfW: w / 2, halfD: d / 2, topY: h, isSolid: true };
  } else if (roll < 0.56) {
    const w = 3.8 + Math.random() * 3.5;
    const h = 1.15;
    const d = 1.2;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hazardMat);
    mesh.position.y = h / 2;
    mesh.userData = { halfW: w / 2, halfD: d / 2, topY: h, isSolid: true };
  } else if (roll < 0.80) {
    mesh = createConcreteUtilityPole();
    mesh.userData = { halfW: 0.38, halfD: 0.38, topY: 11, isSolid: true };
  } else if (roll < 0.90) {
    mesh = createBystanderSilhouette();
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.userData = { halfW: 0.3, halfD: 0.3, topY: 2.1, isSolid: true };
  } else {
    mesh = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 8.5, 0.22), darkMetalMat);
    pole.position.y = 4.25;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.16), darkMetalMat);
    arm.position.set(0.8, 8.4, 0);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.25), lightBulbMat);
    lamp.position.set(1.3, 8.3, 0);
    mesh.add(pole, arm, lamp);
    mesh.rotation.z = (Math.random() - 0.5) * 0.14;
    mesh.userData = { halfW: 0.25, halfD: 0.25, topY: 8.5, isSolid: true };
  }

  mesh.userData.baseX = x;
  mesh.position.set(x, mesh.position.y, z);
  scene.add(mesh);
  props.push(mesh);
}

const tokenGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.14, 12);
tokenGeo.rotateX(Math.PI / 2);

function spawnTokenLine(baseX, startZ) {
  const isHighLine = Math.random() < 0.35;
  const yHeight = isHighLine ? 2.4 : 1.05;

  for (let i = 0; i < 4; i++) {
    const coin = new THREE.Mesh(tokenGeo, tokenMat);
    const zPos = startZ - i * 3.8;
    coin.position.set(baseX, yHeight, zPos);
    coin.userData = {
      baseX: baseX,
      baseY: yHeight,
      active: true,
      phase: i * 0.5
    };
    scene.add(coin);
    coins.push(coin);
  }
}

function createOverheadMonorail(zPos, speedDir) {
  const viaduct = new THREE.Group();
  const track = new THREE.Mesh(new THREE.BoxGeometry(340, 1.4, 2.6), buildingMat);
  track.position.y = 14.5;
  viaduct.add(track);

  const train = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 2.1), darkMetalMat);
  body.position.y = 16.3;
  train.add(body);

  for (let wx = -7; wx <= 7; wx += 2.8) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.16), trainWindowMat);
    win.position.set(wx, 16.5, 0);
    train.add(win);
  }

  train.userData = {
    baseX: (Math.random() - 0.5) * LOOP_WIDTH,
    velX: speedDir * (18 + Math.random() * 14)
  };
  viaduct.add(train);
  viaduct.position.z = zPos;
  scene.add(viaduct);
  monorailTrains.push({ viaduct, train });
}

function populateWorld() {
  props.forEach(p => scene.remove(p));
  props = [];
  coins.forEach(c => scene.remove(c));
  coins = [];
  monorailTrains.forEach(m => scene.remove(m.viaduct));
  monorailTrains = [];

  for (let i = 0; i < activeConfig.density; i++) {
    const x = (Math.random() - 0.5) * LOOP_WIDTH;
    const z = -24 - Math.random() * (Z_DEPTH - 24);
    createProp(x, z);
  }

  for (let i = 0; i < activeConfig.spawnLineCount; i++) {
    const x = (Math.random() - 0.5) * LOOP_WIDTH;
    const z = -25 - Math.random() * (Z_DEPTH - 25);
    spawnTokenLine(x, z);
  }

  createOverheadMonorail(-55, 1);
  createOverheadMonorail(-115, -1);
}

// ==========================================
// 6. DOM ELEMENTS & SHOP LOGIC
// ==========================================
const overlay = document.getElementById('overlay');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const startBtn = document.getElementById('start-btn');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const hudTokensEl = document.getElementById('hud-tokens');
const menuTokensEl = document.getElementById('menu-tokens');
const driftEl = document.getElementById('drift');

const UPGRADE_COSTS = [0, 25, 50, 90, 150];
const SKIN_PRICES = { default: 0, sodium: 50, rust: 100, void: 175 };

function updateShopUI() {
  highScoreEl.textContent = `${String(Math.floor(saveData.highScore)).padStart(4, '0')} m`;
  hudTokensEl.textContent = String(saveData.tokens).padStart(3, '0');
  menuTokensEl.textContent = saveData.tokens;

  ['strafe', 'jump', 'magnet'].forEach(key => {
    const lvl = saveData.upgrades[key];
    document.getElementById(`lvl-${key}`).textContent = `LVL ${lvl} / 5`;
    const btn = document.getElementById(`buy-${key}`);
    if (lvl >= 5) {
      btn.textContent = 'MAXED';
      btn.disabled = true;
    } else {
      const cost = UPGRADE_COSTS[lvl];
      btn.textContent = `${cost} TKN`;
      btn.disabled = saveData.tokens < cost;
    }
  });

  document.querySelectorAll('.skin-btn').forEach(btn => {
    const skinId = btn.dataset.skin;
    const isUnlocked = saveData.unlockedSkins.includes(skinId);
    const isEquipped = saveData.equippedSkin === skinId;

    if (isEquipped) {
      btn.textContent = 'DEPLOYED';
      btn.disabled = true;
    } else if (isUnlocked) {
      btn.textContent = 'DEPLOY';
      btn.disabled = false;
    } else {
      const price = SKIN_PRICES[skinId];
      btn.textContent = `${price} TKN`;
      btn.disabled = saveData.tokens < price;
    }
  });
}

['strafe', 'jump', 'magnet'].forEach(key => {
  document.getElementById(`buy-${key}`).addEventListener('click', () => {
    const lvl = saveData.upgrades[key];
    if (lvl >= 5) return;
    const cost = UPGRADE_COSTS[lvl];
    if (saveData.tokens >= cost) {
      saveData.tokens -= cost;
      saveData.upgrades[key]++;
      writeSave();
      updateShopUI();
      playCoinSound();
    }
  });
});

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const skinId = btn.dataset.skin;
    if (saveData.unlockedSkins.includes(skinId)) {
      saveData.equippedSkin = skinId;
      applyWorldSettings(skinId);
      populateWorld();
      writeSave();
      updateShopUI();
    } else {
      const price = SKIN_PRICES[skinId];
      if (saveData.tokens >= price) {
        saveData.tokens -= price;
        saveData.unlockedSkins.push(skinId);
        saveData.equippedSkin = skinId;
        applyWorldSettings(skinId);
        populateWorld();
        writeSave();
        updateShopUI();
        playCoinSound();
      }
    }
  });
});

document.querySelectorAll('.tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.getElementById('tab-upgrades').classList.toggle('hidden', target !== 'upgrades');
    document.getElementById('tab-skins').classList.toggle('hidden', target !== 'skins');
  });
});

// ==========================================
// 7. INPUTS, PHYSICS & MAIN GAME LOOP
// ==========================================
let isPlaying = false;
let forwardDist = 0;
let lateralDist = 0;
let runTokens = 0;
let speed = 28;
let strafeVel = 0;

let playerFeetY = 0;
let jumpVel = 0;
const GRAVITY = -36;

const keys = { left: false, right: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (isPlaying && playerFeetY <= 0.01) {
      jumpVel = 14.2 + (saveData.upgrades.jump - 1) * 1.15;
      playJumpSound();
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function startGame() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  forwardDist = 0;
  lateralDist = 0;
  runTokens = 0;
  speed = 28 * activeConfig.speedMult;
  strafeVel = 0;
  playerFeetY = 0;
  jumpVel = 0;

  populateWorld();
  isPlaying = true;
  overlay.style.display = 'none';
}

function triggerGameOver() {
  isPlaying = false;
  playCrashSound();

  const finalDist = Math.floor(forwardDist);
  let recordNote = '';
  if (finalDist > saveData.highScore) {
    saveData.highScore = finalDist;
    recordNote = ' [NEW RECORD!]';
  }
  writeSave();
  updateShopUI();

  titleEl.textContent = 'COLLISION';
  subtitleEl.innerHTML =
    `DISTANCE: ${finalDist}m${recordNote} &nbsp;|&nbsp; TOKENS EARNED: +${runTokens}<br>` +
    `WORLD SCORING MULTIPLIER ACTIVE: ${activeConfig.scoreMult}x`;
  startBtn.textContent = 'RE-ENTER';
  overlay.style.display = 'flex';
}

startBtn.addEventListener('click', startGame);

applyWorldSettings(saveData.equippedSkin);
updateShopUI();
populateWorld();

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (isPlaying) {
    speed += dt * 0.52 * activeConfig.speedMult;
    forwardDist += speed * dt * activeConfig.scoreMult;

    const inputDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const strafeBonus = (saveData.upgrades.strafe - 1) * 4.2;
    const maxStrafeSpeed = 23 + strafeBonus + speed * 0.22;
    strafeVel += (inputDir * maxStrafeSpeed - strafeVel) * (10 + saveData.upgrades.strafe) * dt;
    lateralDist += strafeVel * dt;

    if (playerFeetY > 0 || jumpVel > 0) {
      playerFeetY += jumpVel * dt;
      jumpVel += GRAVITY * dt;
      if (playerFeetY <= 0) {
        playerFeetY = 0;
        jumpVel = 0;
      }
    }

    const headBob = playerFeetY === 0 ? Math.sin(forwardDist * 0.05) * 0.05 : 0;
    camera.position.y = EYE_HEIGHT + playerFeetY + headBob;
    camera.rotation.z = -strafeVel * 0.0042;

    groundTex.offset.y += (speed / 340) * 60 * dt;
    groundTex.offset.x += (strafeVel / 340) * 60 * dt;

    if (droneOsc) {
      droneOsc.frequency.setTargetAtTime(40 + speed * 0.38, audioCtx.currentTime, 0.1);
    }

    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      p.position.z += speed * dt;

      if (p.position.z > 8) {
        p.position.z -= Z_DEPTH;
        p.userData.baseX = (Math.random() - 0.5) * LOOP_WIDTH;
      }

      p.position.x = wrapX(p.userData.baseX - lateralDist);

      if (p.userData.isSolid && Math.abs(p.position.z) < p.userData.halfD + 0.35) {
        if (Math.abs(p.position.x) < p.userData.halfW + 0.35) {
          if (playerFeetY < p.userData.topY - 0.1) {
            triggerGameOver();
            break;
          }
        }
      }
    }

    const magnetRadius = 1.4 + (saveData.upgrades.magnet - 1) * 1.65;
    const playerCenterY = playerFeetY + 0.9;

    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      c.position.z += speed * dt;
      c.rotation.y += 3.2 * dt;

      if (c.position.z > 8) {
        c.position.z -= Z_DEPTH;
        c.userData.baseX = (Math.random() - 0.5) * LOOP_WIDTH;
        c.position.y = c.userData.baseY;
        c.visible = true;
        c.userData.active = true;
      }

      if (!c.userData.active) continue;

      let targetX = wrapX(c.userData.baseX - lateralDist);
      const dx = -targetX;
      const dy = playerCenterY - c.position.y;
      const dz = -c.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < magnetRadius * magnetRadius && c.position.z > -18) {
        c.userData.baseX += dx * 8 * dt;
        c.position.y += dy * 8 * dt;
        targetX = wrapX(c.userData.baseX - lateralDist);
      }

      c.position.x = targetX;

      if (distSq < 1.55) {
        c.userData.active = false;
        c.visible = false;
        
        const earnings = activeConfig.tokenBonus;
        runTokens += earnings;
        saveData.tokens += earnings;
        
        hudTokensEl.textContent = String(saveData.tokens).padStart(3, '0');
        playCoinSound();
      }
    }

    for (let i = 0; i < monorailTrains.length; i++) {
      const m = monorailTrains[i];
      m.viaduct.position.z += speed * dt;
      if (m.viaduct.position.z > 15) {
        m.viaduct.position.z -= Z_DEPTH;
      }
      m.train.userData.baseX += m.train.userData.velX * dt;
      m.train.position.x = wrapX(m.train.userData.baseX - lateralDist);
    }

    const currentMeters = Math.floor(forwardDist);
    scoreEl.textContent = `${String(currentMeters).padStart(4, '0')} m`;
    if (currentMeters > saveData.highScore) {
      highScoreEl.textContent = `${String(currentMeters).padStart(4, '0')} m`;
    }
    const dirTag = lateralDist >= 0 ? 'E' : 'W';
    driftEl.textContent = `${String(Math.floor(Math.abs(lateralDist))).padStart(4, '0')} m ${dirTag}`;

  } else {
    lateralDist += 3.5 * dt;
    groundTex.offset.x += (3.5 / 340) * 60 * dt;
    groundTex.offset.y += (6 / 340) * 60 * dt;

    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      p.position.z += 6 * dt;
      if (p.position.z > 8) p.position.z -= Z_DEPTH;
      p.position.x = wrapX(p.userData.baseX - lateralDist);
    }
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      c.position.z += 6 * dt;
      c.rotation.y += 2.5 * dt;
      if (c.position.z > 8) c.position.z -= Z_DEPTH;
      c.position.x = wrapX(c.userData.baseX - lateralDist);
    }
    for (let i = 0; i < monorailTrains.length; i++) {
      const m = monorailTrains[i];
      m.viaduct.position.z += 6 * dt;
      if (m.viaduct.position.z > 15) m.viaduct.position.z -= Z_DEPTH;
      m.train.userData.baseX += m.train.userData.velX * dt;
      m.train.position.x = wrapX(m.train.userData.baseX - lateralDist);
    }
  }

  renderer.render(scene, camera);
}

animate(performance.now());
