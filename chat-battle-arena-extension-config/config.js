const params = new URLSearchParams(window.location.search);
const twitch = window.Twitch?.ext;

let token = params.get("token") || "";
let userId = params.get("userId") || "dev-user";
let globalChannelId = params.get("channel") || "channel123";

const BACKEND_URL = (params.get("backend") || "https://4059-41-90-172-222.ngrok-free.app").replace(/\/$/, "");
const OVERLAY_URL = (params.get("overlay") || "https://6e72-41-90-172-222.ngrok-free.app").replace(/\/$/, "");
let currentStep = 0;

function authHeaders() {
  const headers = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function showConfig() {
  document.getElementById("urlSpinner").style.display = "none";
  document.querySelector(".config-container").style.display = "block";
  renderWizardStep();
}

function setInlineStatus(message, state = "idle") {
  const status = document.querySelector(".save-inline-status");
  status.textContent = message;
  status.className = `save-inline-status ${state}`;
}

function renderWizardStep() {
  document.querySelectorAll(".wizard-step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === currentStep);
  });

  document.querySelectorAll(".wizard-dot").forEach((dot) => {
    const step = Number(dot.dataset.step);
    dot.classList.toggle("active", step === currentStep);
    dot.classList.toggle("complete", step < currentStep);
  });

  document.querySelector(".wizard-back").disabled = currentStep === 0;
  document.querySelector(".wizard-next").style.display = currentStep === 2 ? "none" : "inline-flex";
  document.querySelector(".save-button").style.display = currentStep === 2 ? "inline-flex" : "none";
}

function hydrateSessionForm(channelId, data = {}) {
  const fullUrl = `${OVERLAY_URL}/${channelId}`;
  document.querySelector(".url-input").value = fullUrl;
  document.querySelector(".channel-id").textContent = channelId;
  document.querySelector(".name-input").value = data.name || `Streamer ${channelId}`;
  document.querySelector(".costreamer-input").value = data.friend_code || "";
  document.querySelector(".enemy-input").value = data.enemy_name || "Auto";
  showConfig();
}

async function setNameFromTwitch(auth) {
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
  const username = body.data?.at(0)?.display_name;
  if (username) {
    document.querySelector(".name-input").value = username;
  }
}

async function fetchSession(channelId) {
  const response = await fetch(`${BACKEND_URL}/sessions/${channelId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Session fetch failed: HTTP ${response.status}`);
  }

  return response.json();
}

async function updateSession(channelId) {
  const activeTab = document.querySelector(".tab-button.active")?.dataset.tab;
  const friendCode = activeTab === "singleplayer"
    ? ""
    : document.querySelector(".costreamer-input").value.trim();

  const sessionData = {
    channel_id: channelId,
    friend_code: friendCode || null,
    name: document.querySelector(".name-input").value.trim() || `Streamer ${channelId}`,
    health: 50,
    enemy_name: document.querySelector(".enemy-input").value.trim() || "Auto",
  };

  const response = await fetch(`${BACKEND_URL}/sessions/${channelId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(sessionData),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Session update failed: HTTP ${response.status} ${text}`);
  }

  return response.json();
}

async function initializeConfig(auth = null) {
  if (auth) {
    token = auth.token;
    userId = auth.userId;
    globalChannelId = auth.channelId || globalChannelId;
  }

  try {
    const session = await fetchSession(globalChannelId);
    hydrateSessionForm(globalChannelId, session);
    if (auth && !session.name) {
      await setNameFromTwitch(auth).catch((error) => {
        console.warn("Could not hydrate Twitch display name", error);
      });
    }
  } catch (error) {
    console.warn("Falling back to local config defaults", error);
    hydrateSessionForm(globalChannelId);
  }
}

if (twitch?.onContext) {
  twitch.onContext((context) => console.log("Twitch context", context));
}

if (twitch?.onAuthorized) {
  twitch.onAuthorized((auth) => {
    void initializeConfig(auth);
  });
  setTimeout(() => {
    if (document.querySelector(".config-container").style.display === "none") {
      void initializeConfig();
    }
  }, 1000);
} else {
  void initializeConfig();
}

document.querySelector(".toggle-visibility").addEventListener("click", () => {
  const urlInput = document.querySelector(".url-input");
  urlInput.type = urlInput.type === "password" ? "text" : "password";
});

document.querySelector(".copy-url-button").addEventListener("click", async () => {
  const url = document.querySelector(".url-input").value;
  const button = document.querySelector(".copy-url-button");
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Copied";
    setInlineStatus("Overlay URL copied.", "success");
    setTimeout(() => {
      button.textContent = "Copy Overlay URL";
    }, 1200);
  } catch (error) {
    console.warn("Clipboard failed", error);
    document.querySelector(".url-input").type = "text";
    button.textContent = "URL Revealed";
    setInlineStatus("Twitch blocked clipboard access here. Copy the revealed URL manually.", "error");
    setTimeout(() => {
      button.textContent = "Copy Overlay URL";
    }, 1800);
  }
});

document.querySelector(".wizard-back").addEventListener("click", () => {
  currentStep = Math.max(0, currentStep - 1);
  setInlineStatus("");
  renderWizardStep();
});

document.querySelector(".wizard-next").addEventListener("click", () => {
  currentStep = Math.min(2, currentStep + 1);
  setInlineStatus("");
  renderWizardStep();
});

document.querySelectorAll(".wizard-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    currentStep = Number(dot.dataset.step);
    setInlineStatus("");
    renderWizardStep();
  });
});

document.querySelector(".costreamer-input").addEventListener("input", (event) => {
  console.log("Co-streamer code:", event.target.value);
});

document.querySelector(".save-button").addEventListener("click", async () => {
  const saveButton = document.querySelector(".save-button");
  const originalText = saveButton.textContent;

  try {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    setInlineStatus("Saving streamer setup...", "loading");

    await updateSession(globalChannelId);

    const notification = document.querySelector(".save-notification");
    notification.classList.add("show");
    setTimeout(() => notification.classList.remove("show"), 3000);

    saveButton.textContent = "Saved";
    setInlineStatus("Saved. You can activate the extension and open the overlay URL.", "success");
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }, 1200);
  } catch (error) {
    console.error("Error saving settings:", error);
    saveButton.textContent = originalText;
    saveButton.disabled = false;
    setInlineStatus(error.message, "error");
  }
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach((btn) => {
      btn.classList.remove("active");
    });
    button.classList.add("active");

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.style.display = "none";
    });

    const tabId = button.getAttribute("data-tab");
    document.getElementById(`${tabId}-content`).style.display = "block";

    if (tabId === "singleplayer") {
      document.querySelector(".costreamer-input").value = "";
    }
  });
});
