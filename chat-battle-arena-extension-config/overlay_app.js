import { getAvatarPath } from "./avatars.js";

let isInitialized = false;
let globalHealth = 50;
const ATTACK_TRAVEL_MS = 8000;

const overlayParams = new URLSearchParams(window.location.search);
const backendUrl = (
  overlayParams.get("backend") ||
  window.CHAT_BATTLE_ARENA_BACKEND_URL ||
  "https://6c6e-105-161-235-254.ngrok-free.app"
).replace(/\/$/, "");

function showDebugStatus(message) {
  if (document.body.classList.contains("twitch-video-overlay") && overlayParams.get("debug") !== "true") {
    return;
  }

  let status = document.getElementById("debug-status");
  if (!status) {
    status = document.createElement("div");
    status.id = "debug-status";
    status.style.position = "fixed";
    status.style.left = "12px";
    status.style.top = "12px";
    status.style.padding = "8px 10px";
    status.style.background = "rgba(0,0,0,0.72)";
    status.style.color = "white";
    status.style.fontFamily = "monospace";
    status.style.fontSize = "12px";
    status.style.zIndex = "2000";
    document.body.appendChild(status);
  }
  status.textContent = message;
}

function initializeLocalFallback() {
  if (isInitialized) {
    return;
  }
  renderCastles("Host", "Auto");
  addHealthBar(globalHealth);
  isInitialized = true;
  showDebugStatus(`local fallback rendered; waiting for socket ${backendUrl}`);
}

// Function to initialize the application
function initializeApp(channelId = null) {
  // Twitch fullscreen overlays use auth.channelId; standalone tests can use ?channel= or /:channel.
  const urlParts = window.location.pathname.split("/");
  const senderId = channelId || overlayParams.get("channel") || urlParts[1] || "channel123";
  console.log(senderId);
  console.log(backendUrl);
  showDebugStatus(`connecting ${backendUrl} channel=${senderId}`);

  // Connect to the Socket.IO server
  const socket = io(backendUrl, {
    query: { channel: senderId },
    transports: ["websocket"],
  });

  setTimeout(initializeLocalFallback, 1200);

  // Listen for the "attack" event
  socket.on("attack", (attack) => {
    console.log("Received new attack for this channel:", attack);
    spawnAnimatedGifWithText(attack);
    console.log("channel_id:", senderId);
  });

  socket.on("game_over", (result) => {
    // Hide existing elements
    const castles = document.querySelectorAll(".castle");
    const playerNames = document.querySelectorAll(".player-name");
    const animatedContainers = document.querySelectorAll(".animatedContainer");

    [...castles, ...playerNames, ...animatedContainers].forEach((el) => {
      el.style.display = "none";
    });

    // Create winner announcement
    const winner = document.createElement("div");
    winner.classList.add("winner-announcement");
    winner.textContent = `${result.winner} has won!`;
    container.appendChild(winner);

    // Add screen shake
    container.classList.add("screen-shake");

    // Reset everything after animation
    setTimeout(() => {
      // Remove winner announcement and screen shake
      winner.remove();
      container.classList.remove("screen-shake");

      // Show elements again
      [...castles, ...playerNames].forEach((el) => {
        el.style.display = "";
      });

      // Reset health to 50%
      globalHealth = 50;
      updateHealthBar(0);
    }, 3000);
  });

  socket.on("initialize", (session) => {
    console.log(session);
    if (!isInitialized) {
      renderCastles(session.leftName || "Host", session.rightName || "Auto");
      addHealthBar(session.health);
      globalHealth = session.health;
      isInitialized = true;
    }
    showDebugStatus(`initialized channel=${senderId} backend=${backendUrl}`);
  });

  // Handle connection and disconnection events
  socket.on("connect", () => {
    console.log("Connected to the server");
    showDebugStatus(`socket connected ${socket.id}`);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connect error:", error);
    showDebugStatus(`socket error: ${error.message}`);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from the server");
    showDebugStatus("socket disconnected");
  });
}

function renderCastles(name1, name2) {
  const container = document.getElementById("container");
  if (!document.querySelector(".arena-surface")) {
    const surface = document.createElement("div");
    surface.classList.add("arena-surface");
    container.appendChild(surface);
  }

  // Create left castle and name
  const leftCastle = document.createElement("img");
  leftCastle.src = "blue-castle.gif";
  leftCastle.classList.add("castle", "castle-left");

  const leftName = document.createElement("div");
  leftName.textContent = name1;
  leftName.classList.add("player-name", "player-name-left");

  // Create right castle and name
  const rightCastle = document.createElement("img");
  rightCastle.src = "red-castle.gif";
  rightCastle.classList.add("castle", "castle-right");

  const rightName = document.createElement("div");
  rightName.textContent = name2;
  rightName.classList.add("player-name", "player-name-right");

  // Add to container
  container.appendChild(leftCastle);
  container.appendChild(rightCastle);
  container.appendChild(leftName);
  container.appendChild(rightName);
}

function hurtCastle(side, damage) {
  const castleSide = side === "left" ? "right" : "left";
  const castle = document.querySelector(`.castle-${castleSide}`);

  // Keep the active animated castle GIF and add impact feedback.
  castle.classList.add("shake");

  damage = side === "right" ? -damage : damage;
  updateHealthBar(damage);
  setTimeout(() => {
    castle.classList.remove("shake");
  }, 500);
}

function addHealthBar(leftPercentage) {
  document.querySelectorAll(".tower-health").forEach((bar) => bar.remove());

  const container = document.getElementById("container");
  const leftHealth = document.createElement("div");
  leftHealth.classList.add("tower-health", "tower-health-left");
  const leftProgress = document.createElement("div");
  leftProgress.classList.add("tower-health-progress");
  leftHealth.appendChild(leftProgress);

  const rightHealth = document.createElement("div");
  rightHealth.classList.add("tower-health", "tower-health-right");
  const rightProgress = document.createElement("div");
  rightProgress.classList.add("tower-health-progress");
  rightHealth.appendChild(rightProgress);

  container.appendChild(leftHealth);
  container.appendChild(rightHealth);
  updateTowerHealthBars(leftPercentage);
}

function updateTowerHealthBars(leftPercentage) {
  const leftProgress = document.querySelector(
    ".tower-health-left .tower-health-progress",
  );
  const rightProgress = document.querySelector(
    ".tower-health-right .tower-health-progress",
  );

  if (!leftProgress || !rightProgress) {
    return;
  }

  const leftPct = Math.max(0, Math.min(100, leftPercentage));
  const rightPct = 100 - leftPct;
  leftProgress.style.width = `${leftPct}%`;
  rightProgress.style.width = `${rightPct}%`;
}

function updateHealthBar(change) {
  const currentBar = document.querySelector(".tower-health-progress");
  if (currentBar) {
    globalHealth = Math.max(0, Math.min(100, globalHealth + change));
    updateTowerHealthBars(globalHealth);
  } else {
    globalHealth = Math.max(0, Math.min(100, 100 + change));
    addHealthBar(globalHealth);
  }
}

function spawnAnimatedGifWithText(attack) {
  const animatedContainer = document.createElement("div");
  animatedContainer.classList.add("animatedContainer");
  animatedContainer.style.animationDuration = `${ATTACK_TRAVEL_MS}ms`;

  // Set initial position and animation based on side
  if (attack.side === "right") {
    animatedContainer.style.right = "70px";
    animatedContainer.style.left = "auto";
    animatedContainer.style.animation = `moveLeft ${ATTACK_TRAVEL_MS}ms linear`;
  } else {
    animatedContainer.style.left = "70px";
    animatedContainer.style.animation = `moveRight ${ATTACK_TRAVEL_MS}ms linear`;
  }

  const textElement = document.createElement("div");
  textElement.classList.add("animatedText");
  textElement.innerText = attack.user_name;

  const gifElement = document.createElement("img");
  gifElement.src = getAvatarPath(attack.attack_id);
  gifElement.classList.add("animatedImage");
  if (attack.attack_id === 9) {
    gifElement.classList.add("scoutCharacterImage");
  } else if (attack.attack_id === 10) {
    gifElement.classList.add("bruiserCharacterImage");
  } else if (attack.attack_id === 11) {
    gifElement.classList.add("titanCharacterImage");
  } else if (attack.attack_id === 12) {
    gifElement.classList.add("rookieCharacterImage");
  } else if (attack.attack_id === 13) {
    gifElement.classList.add("runnerCharacterImage");
  } else if (attack.attack_id === 14) {
    gifElement.classList.add("soldierBoyCharacterImage");
  } else if (attack.attack_id === 15) {
    gifElement.classList.add("bombatCharacterImage");
  } else if (attack.attack_id === 16) {
    gifElement.classList.add("zoniacCharacterImage");
  }

  // Flip the GIF if moving from right to left
  if (attack.side === "right") {
    gifElement.style.transform = "scaleX(-1)";
  }

  animatedContainer.appendChild(textElement);
  animatedContainer.appendChild(gifElement);
  container.appendChild(animatedContainer);

  animatedContainer.addEventListener(
    "animationend",
    () => {
      hurtCastle(attack.side, attack.damage);
      setTimeout(() => {
        animatedContainer.remove();
      }, 300);
    },
    { once: true },
  );
}

// Initialize the app on page load. Prefer Twitch channel identity when available.
window.addEventListener("load", () => {
  const twitchExt = window.Twitch?.ext;
  if (twitchExt?.onAuthorized) {
    let initialized = false;
    twitchExt.onAuthorized((auth) => {
      initialized = true;
      initializeApp(auth.channelId);
    });
    setTimeout(() => {
      if (!initialized) initializeApp();
    }, 1200);
  } else {
    initializeApp();
  }
});

// Handle navigation without reloading the page
window.addEventListener("popstate", initializeApp);
