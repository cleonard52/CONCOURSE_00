// ==========================================================================
// GAME STATE & WORLD DEFINITIONS DATASET
// ==========================================================================

const WORLDS_DATABASE = [
  {
    id: "default",
    name: "CORE OUTPOST",
    skinClass: "skin-default",
    cost: 0,
    multiplier: 1.0,
    spawnRate: "Low",
    density: "Low",
    description: "Standard industrial zone. Low density navigation streams."
  },
  {
    id: "sodium",
    name: "SODIUM FLATS",
    skinClass: "skin-sodium",
    cost: 500,
    multiplier: 1.5,
    spawnRate: "Medium",
    density: "Medium",
    description: "Corrosive alkaline deserts. Moderate debris obstacles."
  },
  {
    id: "rust",
    name: "RUST WASTELANDS",
    skinClass: "skin-rust",
    cost: 1500,
    multiplier: 2.5,
    spawnRate: "High",
    density: "High",
    description: "Crumbled metal canyons. High-density structures encountered."
  },
  {
    id: "void",
    name: "THE NEON VOID",
    skinClass: "skin-void",
    cost: 5000,
    multiplier: 5.0,
    spawnRate: "Abundant",
    density: "Chaotic",
    description: "Unstable digital abyss. Maximum risk, extreme point scaling."
  }
];

// Persistent Reactive State Variables
let playerState = {
  tokens: 1200, // Starting default cash for testing; change as desired
  unlockedWorlds: ["default"],
  activeWorldId: "default"
};

// Canvas Core Reference Hook
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==========================================================================
// SYSTEM LIFE CYCLE INITIALIZATION
// ==========================================================================

function initSystem() {
  loadSavedGame();
  setupDomEventListeners();
  syncDisplayLayouts();
  renderWorldsCatalog();
  handleResize();
  window.addEventListener('resize', handleResize);
  
  // Begin running safe stub render loop
  requestAnimationFrame(gameLoop);
}

// Balance and Data Storage Logic
function saveGame() {
  localStorage.setItem("cyber_runner_save", JSON.stringify(playerState));
}

function loadSavedGame() {
  const fileData = localStorage.getItem("cyber_runner_save");
  if (fileData) {
    try {
      const parsed = JSON.parse(fileData);
      if (parsed && parsed.unlockedWorlds) {
        playerState = { ...playerState, ...parsed };
      }
    } catch (e) {
      console.error("Save file corrupted, tracking fallback settings.", e);
    }
  }
}

// Canvas Screen Scaling Handler
function handleResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ==========================================================================
// DOM VIEW RENDER & COMPONENT SYNC ENGINE
// ==========================================================================

function syncDisplayLayouts() {
  const activeWorld = WORLDS_DATABASE.find(w => w.id === playerState.activeWorldId) || WORLDS_DATABASE;
  
  // Enforce Skin Class on Document Parent Node
  document.body.className = activeWorld.skinClass;
  
  // Sync Text Elements Across Screen Layers
  document.getElementById("hud-world-name").innerText = activeWorld.name;
  document.getElementById("hud-multiplier").innerText = `${activeWorld.multiplier.toFixed(1)}x`;
  document.getElementById("hud-tokens").innerText = Math.floor(playerState.tokens);
  document.getElementById("shop-tokens").innerText = Math.floor(playerState.tokens);
}

function renderWorldsCatalog() {
  const catalogGrid = document.getElementById("worlds-catalog");
  catalogGrid.innerHTML = ""; // Clear active markup layout

  WORLDS_DATABASE.forEach(world => {
    const isUnlocked = playerState.unlockedWorlds.includes(world.id);
    const isActive = playerState.activeWorldId === world.id;
    
    // Assemble Item Row Container
    const itemRow = document.createElement("div");
    itemRow.className = "shop-item";
    
    // Info Container Block
    const infoBlock = document.createElement("div");
    infoBlock.className = "item-info";
    
    const title = document.createElement("div");
    title.className = "item-title";
    title.innerText = world.name;
    
    const desc = document.createElement("div");
    desc.className = "item-desc";
    desc.innerText = world.description;
    
    const telemetry = document.createElement("div");
    telemetry.className = "item-lvl";
    telemetry.innerText = `Coins: ${world.spawnRate} | Terrain: ${world.density}`;
    
    infoBlock.appendChild(title);
    infoBlock.appendChild(desc);
    infoBlock.appendChild(telemetry);
    
    // Interactive Interface Button
    const actionBtn = document.createElement("button");
    actionBtn.className = "buy-btn";
    
    if (isActive) {
      actionBtn.innerText = "DEPLOYED";
      actionBtn.disabled = true;
    } else if (isUnlocked) {
      actionBtn.innerText = "SELECT";
      actionBtn.addEventListener("click", () => switchActiveWorld(world.id));
    } else {
      actionBtn.innerText = `${world.cost} TKN`;
      if (playerState.tokens < world.cost) {
        actionBtn.disabled = true;
      }
      actionBtn.addEventListener("click", () => purchaseWorld(world));
    }
    
    itemRow.appendChild(infoBlock);
    itemRow.appendChild(actionBtn);
    catalogGrid.appendChild(itemRow);
  });
}

// ==========================================================================
// INTERACTIVE RUNTIME LOGIC ACTIONS
// ==========================================================================

function purchaseWorld(world) {
  if (playerState.tokens >= world.cost && !playerState.unlockedWorlds.includes(world.id)) {
    playerState.tokens -= world.cost;
    playerState.unlockedWorlds.push(world.id);
    playerState.activeWorldId = world.id;
    
    saveGame();
    syncDisplayLayouts();
    renderWorldsCatalog();
  }
}

function switchActiveWorld(worldId) {
  if (playerState.unlockedWorlds.includes(worldId)) {
    playerState.activeWorldId = worldId;
    
    saveGame();
    syncDisplayLayouts();
    renderWorldsCatalog();
  }
}

function setupDomEventListeners() {
  const terminalModal = document.getElementById("overlay");
  const closeBtn = document.getElementById("close-terminal-btn");
  
  closeBtn.addEventListener("click", () => {
    terminalModal.classList.add("hidden");
  });

  // Optional key hook 'M' or 'Escape' to reopen your world menu selection screen
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "m" || e.key === "Escape") {
      terminalModal.classList.remove("hidden");
      renderWorldsCatalog(); // Refresh balances
    }
  });
}

// ==========================================================================
// CANVAS GRAPHICS ANIMATION STUB LOOP
// ==========================================================================

function gameLoop(timestamp) {
  // Clear Frame Screen
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Access active metrics here dynamically to control variables in your engine structure
  const currentActiveWorldId = playerState.activeWorldId;
  const currentMetrics = WORLDS_DATABASE.find(w => w.id === currentActiveWorldId);

  // Simple visual matrix line loop testing dynamic CSS variable bindings mapping canvas assets
  const lineHexColor = getComputedStyle(document.body).getPropertyValue('--border-col').trim();
  
  ctx.strokeStyle = lineHexColor || "#595e56";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.7);
  ctx.lineTo(canvas.width, canvas.height * 0.7);
  ctx.stroke();

  // Text status placeholder instructions
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || "#828a7e";
  ctx.font = "14px 'Courier New'";
  ctx.fillText("[GAME RUNNING - PRESS ESC/M TO TOGGLE SECTOR SHOP MENU]", 28, canvas.height - 30);

  requestAnimationFrame(gameLoop);
}

// Launch System Instance Core
document.addEventListener("DOMContentLoaded", initSystem);