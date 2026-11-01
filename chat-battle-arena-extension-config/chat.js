const params = new URLSearchParams(window.location.search);
const BACKEND_URL = params.get("backend") || "http://127.0.0.1:8010";
const DEFAULT_CHANNEL = params.get("channel") || "channel123";
const DEFAULT_USER = params.get("user") || "devViewer";
const FORCE_DEV_PAYMENTS = params.get("devPayments") === "true";
const BITS_USD_RATE = 1.4 / 100;

let storedChannelId = DEFAULT_CHANNEL;
let storedUsername = DEFAULT_USER;
let twitchAuthToken = "";
let twitchProducts = [];
let isTwitchAuthorized = false;

const CHARACTER_PRODUCTS = [
  { attackId: 9, sku: "9", gifName: "scout-running.gif", productName: "Scout", bitsCost: 0, cooldownMs: 10_000 },
  { attackId: 10, sku: "10", gifName: "bruiser-running.gif", productName: "Bruiser", bitsCost: 40, cooldownMs: 10_000 },
  { attackId: 11, sku: "11", gifName: "titan-running.gif", productName: "Titan", bitsCost: 100, cooldownMs: 10_000 },
  { attackId: 12, sku: "12", gifName: "rookie.gif", productName: "Rookie", bitsCost: 0, cooldownMs: 10_000 },
  { attackId: 13, sku: "13", gifName: "runner.gif", productName: "Runner", bitsCost: 20, cooldownMs: 10_000 },
  { attackId: 14, sku: "14", gifName: "soldier-boy.gif", productName: "Soldier Boy", bitsCost: 40, cooldownMs: 10_000 },
  { attackId: 15, sku: "15", gifName: "bombat.gif", productName: "Bombat", bitsCost: 70, cooldownMs: 10_000 },
  { attackId: 16, sku: "16", gifName: "zoniac.gif", productName: "Zoniac", bitsCost: 120, cooldownMs: 10_000 },
];

function isTwitchMode() {
  return Boolean(window.Twitch?.ext?.bits && isTwitchAuthorized && !FORCE_DEV_PAYMENTS);
}

function productBySku(sku) {
  return CHARACTER_PRODUCTS.find((product) => product.sku === String(sku));
}

function setStatus(message, isError = false) {
  let status = document.getElementById("extensionStatus");
  if (!status) {
    status = document.createElement("div");
    status.id = "extensionStatus";
    status.className = "extension-status";
    document.body.appendChild(status);
  }
  status.textContent = message;
  status.classList.toggle("extension-status-error", isError);
}

function cooldownKey(attackId) {
  return `thearena-cooldown-${storedChannelId}-${attackId}`;
}

function renderCostButton(button, product) {
  button.innerHTML = `
    <span class="diamond-button-content">
      <img class="diamond-icon" src="public/diamond.gif" alt="Diamond cost" />
      <span class="diamond-cost">${product.bitsCost}</span>
    </span>
  `;
}

function getDamageTier(product) {
  if (product.bitsCost >= 100 || [11, 16].includes(product.attackId)) return "damage-high";
  if (product.bitsCost >= 40 || product.attackId >= 5) return "damage-mid";
  return "damage-low";
}

function estimatedUsd(bitsCost) {
  return (bitsCost * BITS_USD_RATE).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function closeDemoPurchaseModal() {
  document.querySelector(".demo-purchase-backdrop")?.remove();
}

function showDemoPurchaseModal(product, button) {
  closeDemoPurchaseModal();

  const backdrop = document.createElement("div");
  backdrop.className = "demo-purchase-backdrop";
  backdrop.setAttribute("role", "presentation");

  const dialog = document.createElement("section");
  dialog.className = "demo-purchase-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "demoPurchaseTitle");

  dialog.innerHTML = `
    <button class="demo-modal-close" type="button" aria-label="Close purchase dialog">×</button>
    <div class="demo-modal-kicker">Demo Bits Purchase</div>
    <h2 id="demoPurchaseTitle">Send ${product.productName}</h2>
    <img class="demo-modal-character" src="public/${product.gifName}" alt="${product.productName}" />
    <div class="demo-cost-card">
      <span class="demo-cost-label">This would use</span>
      <span class="demo-cost-value">
        <img src="public/diamond.gif" alt="" />
        ${product.bitsCost} Diamonds
      </span>
      <span class="demo-cost-note">${product.bitsCost} Bits, approximately ${estimatedUsd(product.bitsCost)}</span>
    </div>
    <p class="demo-modal-copy">
      Demo purchase: confirm to send this warrior.
    </p>
    <div class="demo-modal-actions">
      <button class="demo-cancel-button" type="button">Cancel</button>
      <button class="demo-confirm-button ${getDamageTier(product)}" type="button">
        Confirm Demo Purchase
      </button>
    </div>
  `;

  const closeButton = dialog.querySelector(".demo-modal-close");
  const cancelButton = dialog.querySelector(".demo-cancel-button");
  const confirmButton = dialog.querySelector(".demo-confirm-button");

  const close = () => closeDemoPurchaseModal();
  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    confirmButton.textContent = "Processing...";
    await directSpawn(product, button, false);
    closeDemoPurchaseModal();
  });

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      close();
      document.removeEventListener("keydown", handleKeydown);
    }
  };
  document.addEventListener("keydown", handleKeydown);

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);
  confirmButton.focus();
}

function updateCooldownTimer(button, endTime, product) {
  const timeLeft = endTime - Date.now();

  if (timeLeft <= 0) {
    button.disabled = false;
    renderCostButton(button, product);
    return;
  }

  const seconds = Math.ceil(timeLeft / 1000);
  button.textContent = `${seconds}s`;
  button.disabled = true;
  setTimeout(() => updateCooldownTimer(button, endTime, product), 1000);
}

async function postSpawnAttack(product, options = {}) {
  const payload = {
    sender_session_id: storedChannelId,
    attack_id: product.attackId,
    user_name: storedUsername,
    transaction_id: options.transactionId || null,
    product_sku: product.sku,
    bits_cost: product.bitsCost,
  };

  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (twitchAuthToken) {
    headers.Authorization = `Bearer ${twitchAuthToken}`;
  }

  const response = await fetch(`${BACKEND_URL}/spawn_attack`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || `HTTP ${response.status}`);
  }

  return data;
}

async function directSpawn(product, button, enforceCooldown) {
  const now = Date.now();
  if (enforceCooldown) {
    const lastUseTime = Number(localStorage.getItem(cooldownKey(product.attackId)) || 0);
    if (lastUseTime && now - lastUseTime < product.cooldownMs) {
      updateCooldownTimer(button, lastUseTime + product.cooldownMs, product);
      return;
    }
  }

  button.disabled = true;
  button.textContent = "...";

  try {
    const data = await postSpawnAttack(product);
    if (enforceCooldown) {
      localStorage.setItem(cooldownKey(product.attackId), String(now));
      updateCooldownTimer(button, now + product.cooldownMs, product);
    } else {
      button.disabled = false;
      renderCostButton(button, product);
    }
    setStatus(`${product.productName} sent: ${data?.message || "ok"}`);
  } catch (error) {
    console.error("Error spawning attack:", error);
    setStatus(`Spawn failed: ${error.message}`, true);
    button.disabled = false;
    renderCostButton(button, product);
  }
}

async function handleProductClick(product, button) {
  if (product.bitsCost === 0) {
    await directSpawn(product, button, true);
    return;
  }

  if (!isTwitchMode()) {
    showDemoPurchaseModal(product, button);
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "BUY";
    await window.Twitch.ext.bits.useBits(product.sku);
    setTimeout(() => {
      button.disabled = false;
      renderCostButton(button, product);
    }, 1200);
  } catch (error) {
    console.error("Bits purchase failed:", error);
    setStatus(`Purchase failed: ${error.message || error}`, true);
    button.disabled = false;
    renderCostButton(button, product);
  }
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";

  const titleContainer = document.createElement("div");
  titleContainer.className = "product-title-container";

  const title = document.createElement("h2");
  title.className = "product-title";
  title.textContent = product.productName;
  titleContainer.appendChild(title);

  const gif = document.createElement("img");
  gif.src = `public/${product.gifName}`;
  gif.className = "product-gif";
  gif.alt = product.productName;

  const button = document.createElement("button");
  button.className = `get-button ${getDamageTier(product)}`;
  renderCostButton(button, product);
  button.onclick = () => handleProductClick(product, button);

  const lastUseTime = Number(localStorage.getItem(cooldownKey(product.attackId)) || 0);
  if (product.bitsCost === 0 && lastUseTime && Date.now() - lastUseTime < product.cooldownMs) {
    updateCooldownTimer(button, lastUseTime + product.cooldownMs, product);
  }

  card.appendChild(titleContainer);
  card.appendChild(gif);
  card.appendChild(button);
  return card;
}

function renderProducts() {
  const productGrid = document.getElementById("productGrid");
  productGrid.innerHTML = "";
  CHARACTER_PRODUCTS.forEach((product) => {
    productGrid.appendChild(createProductCard(product));
  });

  const mode = isTwitchMode() ? "Twitch Bits mode" : "Dev direct-spawn mode";
  setStatus(`${mode}: channel=${storedChannelId}`);
}

async function setTwitchUser(auth) {
  if (!window.Twitch?.ext?.viewer?.id || !auth?.helixToken) {
    return;
  }

  const response = await fetch(
    `https://api.twitch.tv/helix/users?id=${window.Twitch.ext.viewer.id}`,
    {
      headers: {
        "client-id": auth.clientId,
        Authorization: `Extension ${auth.helixToken}`,
      },
    },
  );
  const body = await response.json();
  storedUsername = body.data?.at(0)?.display_name || storedUsername;
}

async function loadBitsProducts() {
  if (!window.Twitch?.ext?.bits?.getProducts) {
    return;
  }

  try {
    twitchProducts = await window.Twitch.ext.bits.getProducts();
    console.log("Twitch Bits products", twitchProducts);
    const missingSkus = CHARACTER_PRODUCTS
      .filter((product) => product.bitsCost > 0)
      .filter((product) => !twitchProducts.some((bitsProduct) => bitsProduct.sku === product.sku))
      .map((product) => product.sku);

    if (missingSkus.length) {
      setStatus(`Missing Twitch Bits products: ${missingSkus.join(", ")}`, true);
    }
  } catch (error) {
    console.warn("Unable to load Twitch Bits products", error);
    setStatus(`Bits products unavailable: ${error.message || error}`, true);
  }
}

function registerBitsTransactionHandler() {
  if (!window.Twitch?.ext?.bits?.onTransactionComplete) {
    return;
  }

  window.Twitch.ext.bits.onTransactionComplete(async (transaction) => {
    console.log("Bits transaction completed", transaction);
    const product = productBySku(transaction.product?.sku || transaction.product?.inDevelopment?.sku);
    if (!product) {
      setStatus("Unknown Bits product transaction", true);
      return;
    }

    try {
      const data = await postSpawnAttack(product, {
        transactionId: transaction.transactionId,
      });
      setStatus(`${product.productName} sent: ${data?.message || "ok"}`);
    } catch (error) {
      console.error("Transaction spawn failed", error);
      setStatus(`Paid spawn failed: ${error.message}`, true);
    }
  });
}

function initializeTwitchAuthIfAvailable() {
  const twitchExt = window.Twitch?.ext;
  registerBitsTransactionHandler();

  if (!twitchExt?.onAuthorized) {
    renderProducts();
    return;
  }

  twitchExt.onAuthorized(async (auth) => {
    isTwitchAuthorized = true;
    twitchAuthToken = auth.token || "";
    storedChannelId = auth.channelId || storedChannelId;
    await setTwitchUser(auth).catch((error) => {
      console.warn("Unable to resolve Twitch username; using fallback", error);
    });
    await loadBitsProducts();
    renderProducts();
  });

  setTimeout(() => {
    if (!document.getElementById("productGrid")?.children.length) {
      renderProducts();
    }
  }, 1000);
}

initializeTwitchAuthIfAvailable();
