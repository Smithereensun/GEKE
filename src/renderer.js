const launcher = window.geke ?? createFallbackBridge();
const appElement = document.querySelector("#app");

const state = {
  query: "",
  results: [],
  totalCount: 0,
  scannedPaths: [],
  lastScanAt: null,
  selectedIndex: 0,
  status: "loading",
  statusText: "Scanning applications...",
  statusTone: "info",
  launchError: "",
};

let requestToken = 0;
let isComposing = false;
let ui = null;

bindEvents();
render();
void initialize();

async function initialize() {
  state.status = "loading";
  state.statusText = "Scanning applications...";
  state.statusTone = "info";
  state.launchError = "";
  render();

  try {
    const payload = await launcher.getInitialApps();
    applyPayload(payload);
    state.status = "ready";
    state.statusText = buildStatusText(state.query, payload.results.length, payload.totalCount);
    state.statusTone = "info";
  } catch (error) {
    state.status = "error";
    state.statusText = getErrorMessage(error, "Failed to scan applications.");
    state.statusTone = "error";
    state.results = [];
  }

  render();
  focusInput(state.query ? { cursorToEnd: true } : { selectAll: true });
}

function bindEvents() {
  launcher.onWindowVisible?.(() => {
    focusInput({ cursorToEnd: true });
  });

  window.addEventListener("focus", () => {
    focusInput({ cursorToEnd: true });
  });

  window.addEventListener("keydown", (event) => {
    if (isComposing) {
      return;
    }

    if (event.metaKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      void rescanApplications();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void launchSelected();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      void handleEscape();
    }
  });
}

function createFallbackBridge() {
  const fallbackPayload = {
    query: "",
    results: [],
    totalCount: 0,
    scannedPaths: ["/Applications", "~/Applications", "/System/Applications", "/System/Applications/Utilities"],
    lastScanAt: null,
  };

  return {
    async getInitialApps() {
      return fallbackPayload;
    },
    async searchApplications() {
      return fallbackPayload;
    },
    async rescanApplications() {
      return fallbackPayload;
    },
    async launchApplication() {
      throw new Error("Launching applications is only available inside Electron.");
    },
    async hideLauncher() {
      return true;
    },
    onWindowVisible() {},
  };
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

function buildStatusText(query, resultCount, totalCount) {
  if (query) {
    return resultCount
      ? `${resultCount} result${resultCount === 1 ? "" : "s"} for "${query}"`
      : `No results for "${query}"`;
  }

  return totalCount ? `${totalCount} applications indexed` : "No applications were found in the scanned folders.";
}

function applyPayload(payload) {
  state.results = Array.isArray(payload.results) ? payload.results : [];
  state.totalCount = payload.totalCount ?? 0;
  state.scannedPaths = Array.isArray(payload.scannedPaths) ? payload.scannedPaths : [];
  state.lastScanAt = payload.lastScanAt ?? null;
  state.selectedIndex = state.results.length ? Math.min(state.selectedIndex, state.results.length - 1) : 0;
}

function focusInput({ selectAll = false, cursorToEnd = false } = {}) {
  requestAnimationFrame(() => {
    const input = ui?.searchInput ?? document.querySelector(".search-input");
    if (!input || !input.isConnected || input.disabled || input.readOnly) {
      return;
    }

    input.focus({ preventScroll: true });

    if (selectAll) {
      input.select();
      return;
    }

    if (cursorToEnd) {
      const cursor = input.value.length;
      input.setSelectionRange(cursor, cursor);
    }
  });
}

function moveSelection(offset) {
  if (!state.results.length) {
    return;
  }

  state.selectedIndex = (state.selectedIndex + offset + state.results.length) % state.results.length;
  updateActiveResult();
}

function updateActiveResult() {
  document.querySelectorAll(".result-row").forEach((row, index) => {
    row.dataset.active = String(index === state.selectedIndex);
  });

  document.querySelector(`[data-result-index="${state.selectedIndex}"]`)?.scrollIntoView({
    block: "nearest",
  });
}

async function performSearch(query) {
  const currentToken = ++requestToken;
  state.launchError = "";

  try {
    const payload = await launcher.searchApplications(query);
    if (currentToken !== requestToken) {
      return;
    }

    applyPayload(payload);
    state.status = "ready";
    state.statusText = buildStatusText(query, payload.results.length, payload.totalCount);
    state.statusTone = "info";
  } catch (error) {
    if (currentToken !== requestToken) {
      return;
    }

    state.status = state.results.length ? "ready" : "error";
    state.statusText = getErrorMessage(error, "Search failed.");
    state.statusTone = "error";
  }

  render();
}

async function rescanApplications() {
  const currentToken = ++requestToken;
  const nextQuery = state.query;
  state.status = "loading";
  state.statusText = "Rescanning applications...";
  state.statusTone = "info";
  state.launchError = "";
  render();

  try {
    const payload = await launcher.rescanApplications();
    if (currentToken !== requestToken) {
      return;
    }

    applyPayload(payload);
    state.status = "ready";
    state.statusText = buildStatusText(payload.query, payload.results.length, payload.totalCount);
    state.statusTone = "info";

    if (nextQuery) {
      state.query = nextQuery;
      await performSearch(nextQuery);
      return;
    }
  } catch (error) {
    if (currentToken !== requestToken) {
      return;
    }

    state.status = "error";
    state.statusText = getErrorMessage(error, "Application scan failed.");
    state.statusTone = "error";
    state.results = [];
  }

  render();
  focusInput({ cursorToEnd: true });
}

async function handleEscape() {
  if (state.query) {
    state.query = "";
    state.selectedIndex = 0;
    syncInputValue({ force: true });
    await performSearch("");
    return;
  }

  if (state.launchError) {
    state.launchError = "";
    render();
    return;
  }

  await launcher.hideLauncher();
}

async function launchSelected() {
  const selectedApp = state.results[state.selectedIndex];
  if (!selectedApp) {
    return;
  }

  state.launchError = "";
  state.statusText = `Launching ${selectedApp.name}...`;
  state.statusTone = "info";
  render();

  try {
    await launcher.launchApplication(selectedApp.path);
    await launcher.hideLauncher();
  } catch (error) {
    state.launchError = getErrorMessage(error, `Failed to launch ${selectedApp.name}.`);
    state.statusText = state.launchError;
    state.statusTone = "error";
    render();
  }
}

function onInput(event) {
  state.query = event.currentTarget.value;
  state.selectedIndex = 0;

  if (event.isComposing || isComposing) {
    return;
  }

  void performSearch(state.query);
}

function onCompositionStart() {
  isComposing = true;
}

function onCompositionEnd(event) {
  isComposing = false;
  state.query = event.currentTarget.value;
  state.selectedIndex = 0;
  void performSearch(state.query);
}

function onResultHover(index) {
  if (state.selectedIndex === index) {
    return;
  }

  state.selectedIndex = index;
  updateActiveResult();
}

async function onResultClick(index) {
  state.selectedIndex = index;
  render();
  await launchSelected();
}

function formatTime(value) {
  if (!value) {
    return "Ready";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "AP";
  }

  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderResults() {
  if (state.status === "error" && !state.results.length) {
    return `
      <div class="state-card">
        <div>
          <h2>Unable to load applications</h2>
          <p>${escapeHtml(state.statusText)}</p>
          <div class="state-actions">
            <button class="action-button" type="button" data-action="retry">Retry scan</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.status === "loading" && !state.results.length) {
    return `
      <div class="state-card">
        <div>
          <h2>Scanning applications</h2>
          <p>The launcher is building its local index so the interface never opens as a blank window.</p>
        </div>
      </div>
    `;
  }

  if (!state.results.length) {
    return `
      <div class="state-card">
        <div>
          <h2>No matching applications</h2>
          <p>Try a different app name, an English fragment, or a pinyin abbreviation.</p>
          <div class="state-actions">
            <button class="action-button" type="button" data-action="clear">Clear search</button>
          </div>
        </div>
      </div>
    `;
  }

  return state.results
    .map(
      (item, index) => `
        <button
          class="result-row"
          type="button"
          data-result-index="${index}"
          data-active="${String(index === state.selectedIndex)}"
        >
          <span class="result-icon" aria-hidden="true">${escapeHtml(getInitials(item.name))}</span>
          <span class="result-copy">
            <span class="result-name">${escapeHtml(item.name)}</span>
            <span class="result-path">${escapeHtml(item.path)}</span>
          </span>
          <span class="result-shortcut">Enter</span>
        </button>
      `,
    )
    .join("");
}

function renderShell() {
  appElement.innerHTML = `
    <main class="shell">
      <section class="panel" aria-live="polite">
        <header class="panel-header">
          <div class="brand">
            <div class="brand-mark">GK</div>
            <div class="brand-copy">
              <h1>极刻 GEKE</h1>
              <p>Raycast-style application launcher</p>
            </div>
          </div>
          <div class="meta-copy">
            <p>Last scan ${escapeHtml(formatTime(state.lastScanAt))}</p>
          </div>
        </header>

        <label class="search">
          <span class="search-icon" aria-hidden="true">⌘</span>
          <input
            class="search-input"
            type="text"
            placeholder="Search applications, pinyin, or initials"
            autocomplete="off"
            spellcheck="false"
            autofocus
          />
        </label>

        <div class="status-bar">
          <div class="status-pill"></div>
          <button class="action-button" type="button" data-action="rescan">Rescan</button>
        </div>

        <div class="error-banner" hidden></div>

        <div class="results"></div>

        <footer class="footer">
          <div class="footer-shortcuts">
            <span class="shortcut"><span class="key">↑</span> <span class="key">↓</span> Move</span>
            <span class="shortcut"><span class="key">Enter</span> Launch</span>
            <span class="shortcut"><span class="key">Esc</span> Clear / Hide</span>
            <span class="shortcut"><span class="key">⌘R</span> Rescan</span>
          </div>
          <div class="footer-paths"></div>
        </footer>
      </section>
    </main>
  `;

  ui = {
    metaCopy: document.querySelector(".meta-copy p"),
    searchInput: document.querySelector(".search-input"),
    statusPill: document.querySelector(".status-pill"),
    errorBanner: document.querySelector(".error-banner"),
    results: document.querySelector(".results"),
    footerPaths: document.querySelector(".footer-paths"),
  };

  bindRenderedEvents();
  focusInput({ cursorToEnd: true });
}

function syncInputValue({ force = false } = {}) {
  if (!ui?.searchInput || ui.searchInput.value === state.query) {
    return;
  }

  const inputIsActive = document.activeElement === ui.searchInput;
  if (force || (!inputIsActive && !isComposing)) {
    ui.searchInput.value = state.query;
  }
}

function render() {
  if (!ui) {
    renderShell();
  }

  syncInputValue();

  if (ui.metaCopy) {
    ui.metaCopy.textContent = `Last scan ${formatTime(state.lastScanAt)}`;
  }

  if (ui.statusPill) {
    ui.statusPill.dataset.tone = state.statusTone;
    ui.statusPill.textContent = state.statusText;
  }

  if (ui.errorBanner) {
    ui.errorBanner.hidden = !state.launchError;
    ui.errorBanner.textContent = state.launchError;
  }

  if (ui.results) {
    ui.results.innerHTML = renderResults();
  }

  if (ui.footerPaths) {
    ui.footerPaths.textContent = state.scannedPaths.join(" · ");
  }

  requestAnimationFrame(() => updateActiveResult());
}

function bindRenderedEvents() {
  ui?.searchInput?.addEventListener("input", onInput);
  ui?.searchInput?.addEventListener("compositionstart", onCompositionStart);
  ui?.searchInput?.addEventListener("compositionend", onCompositionEnd);

  appElement.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "retry" || action === "rescan") {
      void rescanApplications();
      return;
    }

    if (action === "clear") {
      state.query = "";
      state.selectedIndex = 0;
      syncInputValue({ force: true });
      void performSearch("");
      return;
    }

    const row = event.target.closest(".result-row");
    if (!row) {
      return;
    }

    const index = Number(row.dataset.resultIndex);
    if (Number.isNaN(index)) {
      return;
    }

    void onResultClick(index);
  });

  ui?.results?.addEventListener("mouseover", (event) => {
    const row = event.target.closest(".result-row");
    if (!row) {
      return;
    }

    const index = Number(row.dataset.resultIndex);
    if (!Number.isNaN(index)) {
      onResultHover(index);
    }
  });
}
