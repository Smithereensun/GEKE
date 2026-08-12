const appElement = document.querySelector("#pin-app");
const bridge = window.gekePin ?? createTauriBridge() ?? createFallbackBridge();
const pinId = new URLSearchParams(window.location.search).get("pinId") || "";

const state = {
  payload: null,
  busy: false,
  blur: 0,
};

void initialize();

function createTauriBridge() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (typeof invoke !== "function") {
    return null;
  }
  return {
    getPinnedImage: (id) => invoke("get_pinned_image", { pinId: id }),
    resizePinnedImage: (id, scale) => invoke("resize_pinned_image", { pinId: id, scale }),
    closePinnedImage: (id) => invoke("close_pinned_image", { pinId: id }),
    startDrag: () => invoke("start_pin_drag"),
  };
}

function createFallbackBridge() {
  return {
    async getPinnedImage(id) {
      return {
        id,
        imageDataUrl: "",
        width: 320,
        height: 220,
        scale: 1,
        createdAt: "",
      };
    },
    async resizePinnedImage(id, scale) {
      return { ...(state.payload || {}), id, scale };
    },
    async closePinnedImage() {
      window.close();
      return true;
    },
    async startDrag() {
      return true;
    },
  };
}

async function initialize() {
  bindEvents();
  try {
    if (!pinId) {
      throw new Error("钉图窗口缺少 ID。");
    }
    state.payload = await bridge.getPinnedImage(pinId);
    render();
  } catch (error) {
    renderError(getErrorMessage(error, "钉图载入失败。"));
  }
}

function bindEvents() {
  appElement.addEventListener("click", (event) => {
    const action = event.target.closest("[data-pin-action]")?.dataset.pinAction;
    if (action === "close") {
      void closePin();
    } else if (action === "zoom-in") {
      void resizeBy(0.12);
    } else if (action === "zoom-out") {
      void resizeBy(-0.12);
    }
  });

  appElement.addEventListener("input", (event) => {
    const slider = event.target.closest("[data-pin-blur]");
    if (!slider) {
      return;
    }
    state.blur = Math.min(Math.max(Number(slider.value) || 0, 0), 16);
    const image = appElement.querySelector(".pin-image");
    if (image) {
      image.style.setProperty("--pin-blur", `${state.blur}px`);
    }
  });

  appElement.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-pin-action], [data-pin-blur], .pin-topbar")) {
      return;
    }
    event.preventDefault();
    void bridge.startDrag();
  });

  appElement.addEventListener("wheel", (event) => {
    if (event.target.closest("[data-pin-blur], .pin-topbar")) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    void resizeBy(delta);
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void closePin();
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      void resizeBy(0.12);
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      void resizeBy(-0.12);
    }
  });
}

function render() {
  const payload = state.payload;
  if (!payload) {
    return;
  }
  appElement.dataset.ready = "true";
  appElement.innerHTML = `
    <main class="pin-frame">
      <img class="pin-image" src="${escapeHtml(payload.imageDataUrl)}" alt="" draggable="false" style="--pin-blur:${escapeHtml(state.blur)}px" />
      <div class="pin-topbar">
        <div class="pin-controls" aria-label="钉图操作">
          <button class="pin-window-button pin-window-button--close" type="button" data-pin-action="close" aria-label="关闭"><span>×</span></button>
          <button class="pin-window-button pin-window-button--min" type="button" data-pin-action="zoom-out" aria-label="缩小"><span>−</span></button>
          <button class="pin-window-button pin-window-button--max" type="button" data-pin-action="zoom-in" aria-label="放大"><span>+</span></button>
        </div>
        <label class="pin-blur-control" aria-label="虚化">
          <span>虚化</span>
          <input type="range" min="0" max="16" step="1" value="${escapeHtml(state.blur)}" data-pin-blur />
        </label>
      </div>
    </main>
  `;
}

function renderError(message) {
  appElement.dataset.ready = "true";
  appElement.innerHTML = `
    <div class="pin-error">
      <strong>无法显示钉图</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

async function resizeBy(delta) {
  if (state.busy || !state.payload) {
    return;
  }
  state.busy = true;
  const nextScale = Math.min(Math.max((Number(state.payload.scale) || 1) + delta, 0.25), 3);
  try {
    state.payload = await bridge.resizePinnedImage(pinId, nextScale);
  } finally {
    state.busy = false;
  }
}

async function closePin() {
  if (state.busy) {
    return;
  }
  state.busy = true;
  try {
    await bridge.closePinnedImage(pinId);
  } catch {
    window.close();
  }
}

function getErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return fallbackMessage;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
