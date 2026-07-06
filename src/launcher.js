const bridge = window.geke ?? createBrowserFallbackBridge();

const app = document.querySelector("#app");
const state = {
  query: "",
  results: [],
  selectedIndex: 0,
  loading: true,
  statusTone: "neutral",
  statusText: "正在扫描应用…",
  totalCount: 0,
  scannedPaths: [],
  lastScanAt: null,
};
let searchSequence = 0;

render();
bindGlobalEvents();
void initialize();

async function initialize() {
  focusInput({ selectAll: true });
  await rescanApplications();
}

function bindGlobalEvents() {
  window.addEventListener("focus", () => focusInput({ selectAll: true }));
  window.addEventListener("keydown", (event) => {
    if (event.metaKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      void rescanApplications();
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveSelection(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveSelection(-1);
        break;
      case "Enter":
        event.preventDefault();
        void launchSelected();
        break;
      case "Escape":
        event.preventDefault();
        void handleEscape();
        break;
      default:
        break;
    }
  });
}

function createBrowserFallbackBridge() {
  return {
    async searchApplications(query = "") {
      return {
        query,
        results: [],
        totalCount: 0,
        scannedPaths: ["/Applications", "~/Applications", "/System/Applications", "/System/Applications/Utilities"],
        lastScanAt: null,
      };
    },
    async launchApplication() {
      throw new Error("浏览器预览不支持启动应用，请使用 npm run app:dev。");
    },
    async rescanApplications() {
      return {
        query: "",
        results: [],
        totalCount: 0,
        scannedPaths: ["/Applications", "~/Applications", "/System/Applications", "/System/Applications/Utilities"],
        lastScanAt: null,
      };
    },
    async hideLauncher() {
      return true;
    },
  };
}

function focusInput({ selectAll = false, cursorToEnd = false } = {}) {
  const input = document.querySelector(".search-input");
  if (!input) {
    return;
  }

  input.focus();

  if (selectAll) {
    input.select();
    return;
  }

  if (cursorToEnd) {
    const cursor = input.value.length;
    input.setSelectionRange(cursor, cursor);
  }
}

function moveSelection(offset) {
  if (!state.results.length) {
    return;
  }

  const nextIndex = (state.selectedIndex + offset + state.results.length) % state.results.length;
  state.selectedIndex = nextIndex;
  updateActiveResult();
  document.querySelector(`[data-result-index="${nextIndex}"]`)?.scrollIntoView({
    block: "nearest",
  });
}

async function handleEscape() {
  if (state.query) {
    state.query = "";
    state.statusTone = "neutral";
    state.statusText = `已加载 ${state.totalCount} 个应用`;
    render();
    await performSearch("");
    return;
  }

  await bridge.hideLauncher();
}

async function rescanApplications() {
  searchSequence += 1;
  state.loading = true;
  state.statusTone = "neutral";
  state.statusText = "正在扫描应用…";
  render();

  try {
    const payload = await bridge.rescanApplications();
    state.totalCount = payload.totalCount;
    state.scannedPaths = payload.scannedPaths;
    state.lastScanAt = payload.lastScanAt;

    if (state.query.trim()) {
      await performSearch(state.query);
    } else {
      applySearchPayload(payload);
      state.statusTone = "neutral";
      state.statusText = `扫描完成，共 ${payload.totalCount} 个应用`;
    }
  } catch (error) {
    state.statusTone = "error";
    state.statusText = error instanceof Error ? error.message : "扫描失败";
  } finally {
    state.loading = false;
    render();
    focusInput({ cursorToEnd: true });
  }
}

async function performSearch(query) {
  const currentSequence = ++searchSequence;

  try {
    const payload = await bridge.searchApplications(query);
    if (currentSequence !== searchSequence) {
      return;
    }

    applySearchPayload(payload);
    state.statusTone = "neutral";

    if (query.trim()) {
      state.statusText = payload.results.length
        ? `找到 ${payload.results.length} 个结果`
        : `没有匹配 “${query.trim()}” 的应用`;
    } else {
      state.statusText = `已加载 ${payload.totalCount} 个应用`;
    }
  } catch (error) {
    state.statusTone = "error";
    state.statusText = error instanceof Error ? error.message : "搜索失败";
  } finally {
    render();
    focusInput({ cursorToEnd: true });
  }
}

function applySearchPayload(payload) {
  state.results = payload.results;
  state.totalCount = payload.totalCount;
  state.scannedPaths = payload.scannedPaths;
  state.lastScanAt = payload.lastScanAt;
  state.selectedIndex = state.results.length ? Math.min(state.selectedIndex, state.results.length - 1) : 0;
}

async function launchSelected() {
  const current = state.results[state.selectedIndex];
  if (!current) {
    return;
  }

  state.statusTone = "neutral";
  state.statusText = `正在启动 ${current.name}…`;
  render();

  try {
    await bridge.launchApplication(current.path);
    await bridge.hideLauncher();
  } catch (error) {
    state.statusTone = "error";
    state.statusText = error instanceof Error ? error.message : `启动 ${current.name} 失败`;
    render();
  }
}

function onInput(event) {
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

function formatScanPaths() {
  if (!state.scannedPaths.length) {
    return "扫描路径未就绪";
  }

  return state.scannedPaths.join(" · ");
}

function formatTime() {
  if (!state.lastScanAt) {
    return "尚未完成扫描";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(state.lastScanAt));
}

function getInitials(name) {
  return name
    .trim()
    .split(/[\s/]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
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

function updateActiveResult() {
  document.querySelectorAll(".result-item").forEach((element, index) => {
    element.dataset.active = String(index === state.selectedIndex);
  });
}

function renderResults() {
  if (!state.results.length) {
    return `
      <div class="empty-state">
        <div>
          <div>没有可显示的应用</div>
          <div>${escapeHtml(state.query ? "试试名称、拼音首字母或路径片段" : "等待扫描完成，或按 Cmd+R 重新扫描")}</div>
        </div>
      </div>
    `;
  }

  return state.results
    .map(
      (item, index) => `
        <button
          type="button"
          class="result-item"
          data-result-index="${index}"
          data-active="${String(index === state.selectedIndex)}"
        >
          <span class="result-icon">${escapeHtml(getInitials(item.name) || "APP")}</span>
          <span class="result-body">
            <p class="result-name">${escapeHtml(item.name)}</p>
            <p class="result-path">${escapeHtml(item.path)}</p>
          </span>
          <span class="result-action">Enter 启动</span>
        </button>
      `,
    )
    .join("");
}

function render() {
  app.innerHTML = `
    <main class="launcher-shell">
      <section class="launcher-panel">
        <header class="launcher-head">
          <div>
            <h1 class="launcher-title">极刻 GEKE</h1>
            <div class="launcher-meta">macOS 极简应用启动器</div>
          </div>
          <div class="launcher-meta">最近扫描 ${escapeHtml(formatTime())}</div>
        </header>

        <div class="search-wrap">
          <input
            class="search-input"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="搜索应用名称、拼音、首字母或路径"
            value="${escapeHtml(state.query)}"
            aria-label="搜索应用"
          />
        </div>

        <div>
          <div class="status-pill" data-tone="${state.statusTone}">${escapeHtml(state.statusText)}</div>
        </div>

        <section class="results" aria-live="polite">
          ${state.loading && !state.results.length ? '<div class="empty-state"><div>正在建立应用索引…</div></div>' : renderResults()}
        </section>

        <footer class="launcher-footer">
          <div class="hint-row">
            <span class="hint-kbd"><kbd>↑</kbd><kbd>↓</kbd>切换</span>
            <span class="hint-kbd"><kbd>Enter</kbd>启动</span>
            <span class="hint-kbd"><kbd>Esc</kbd>清空/隐藏</span>
            <span class="hint-kbd"><kbd>⌘R</kbd>重新扫描</span>
          </div>
          <div title="${escapeHtml(formatScanPaths())}">扫描路径：${escapeHtml(state.scannedPaths.length)}</div>
        </footer>
      </section>
    </main>
  `;

  const input = document.querySelector(".search-input");
  input?.addEventListener("input", onInput);

  document.querySelectorAll(".result-item").forEach((element, index) => {
    element.addEventListener("mouseenter", () => onResultHover(index));
    element.addEventListener("click", () => {
      void onResultClick(index);
    });
  });
}
