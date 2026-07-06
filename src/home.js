import { fuguangSummary, implementedFeatures, product } from "./data.js";

const app = document.querySelector("#app");
const url = new URL(window.location.href);
const isQuickPanel = url.searchParams.get("panel") === "quick";
const PREVIEW_KEY = "geke-preview-state-v1";

const state = {
  snapshot: null,
  meta: null,
  filters: {
    query: "",
    category: "all",
  },
  editor: createEmptyEditor(),
  selectedId: null,
  message: "",
};

const bridge = window.geke ?? createBrowserPreviewBridge();

void initialize();

async function initialize() {
  const payload = await bridge.bootstrap();
  state.snapshot = payload.state;
  state.meta = payload.meta;
  state.selectedId = payload.state.records[0]?.id ?? null;

  if (state.selectedId) {
    syncEditorFromRecord(findRecordById(state.selectedId));
  }

  bridge.onStateChange((next) => {
    state.snapshot = next.state;
    state.meta = next.meta ?? state.meta;

    if (state.selectedId && !findRecordById(state.selectedId)) {
      state.selectedId = state.snapshot.records[0]?.id ?? null;
      syncEditorFromRecord(findRecordById(state.selectedId));
    }

    render();
  });

  render();
}

function createEmptyEditor(category = "capture") {
  return {
    id: null,
    title: "",
    content: "",
    category,
    tags: "",
  };
}

function createPreviewState() {
  const createdAt = new Date().toISOString();

  return {
    records: [
      {
        id: `preview-${createdAt}-1`,
        title: "欢迎来到 GEKE",
        content: "浏览器预览模式会把记录保存到 localStorage；Electron 版本会写到 userData JSON。",
        category: "draft",
        tags: ["preview", "welcome"],
        source: "manual",
        favorite: true,
        pinned: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    settings: {
      clipboardMonitoring: true,
      quickPanelAlwaysOnTop: true,
      workspaceAlwaysOnTop: false,
      shortcut: "CommandOrControl+Shift+Space",
    },
    updatedAt: createdAt,
  };
}

function createBrowserPreviewBridge() {
  const listeners = new Set();
  let snapshot = readPreviewState();

  function emit() {
    const payload = {
      meta: {
        isElectron: false,
        platform: navigator.platform,
        role: isQuickPanel ? "quick-panel" : "workspace",
        shortcut: "CommandOrControl+Shift+Space",
        userDataPath: "浏览器预览模式使用 localStorage",
      },
      state: snapshot,
    };

    for (const listener of listeners) {
      listener(payload);
    }
  }

  function persist() {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(snapshot));
    emit();
    return snapshot;
  }

  return {
    async bootstrap() {
      return {
        meta: {
          isElectron: false,
          platform: navigator.platform,
          role: isQuickPanel ? "quick-panel" : "workspace",
          shortcut: "CommandOrControl+Shift+Space",
          userDataPath: "浏览器预览模式使用 localStorage",
        },
        state: snapshot,
      };
    },
    async createRecord(payload) {
      const timestamp = new Date().toISOString();
      snapshot = {
        ...snapshot,
        records: [
          {
            id: crypto.randomUUID(),
            title: payload.title || summarizeTitle(payload.content),
            content: payload.content,
            category: payload.category,
            tags: parseTags(payload.tags),
            source: payload.source ?? "manual",
            favorite: false,
            pinned: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...snapshot.records,
        ],
        updatedAt: timestamp,
      };
      return persist();
    },
    async updateRecord(payload) {
      const timestamp = new Date().toISOString();
      snapshot = {
        ...snapshot,
        records: snapshot.records
          .map((record) =>
            record.id === payload.id
              ? {
                  ...record,
                  title: payload.title || summarizeTitle(payload.content),
                  content: payload.content,
                  category: payload.category,
                  tags: parseTags(payload.tags),
                  updatedAt: timestamp,
                }
              : record,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        updatedAt: timestamp,
      };
      return persist();
    },
    async deleteRecord(id) {
      snapshot = {
        ...snapshot,
        records: snapshot.records.filter((record) => record.id !== id),
      };
      return persist();
    },
    async toggleFavorite(id) {
      snapshot = togglePreviewFlag(id, "favorite");
      return persist();
    },
    async togglePinned(id) {
      snapshot = togglePreviewFlag(id, "pinned");
      return persist();
    },
    async captureClipboard() {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        return snapshot;
      }

      return this.createRecord({
        category: "clipboard",
        content: text,
        source: "clipboard",
        tags: "clipboard",
      });
    },
    async writeClipboardText(text) {
      await navigator.clipboard.writeText(text);
      return true;
    },
    async updateSetting(payload) {
      snapshot = {
        ...snapshot,
        settings: {
          ...snapshot.settings,
          [payload.key]: payload.value,
        },
      };
      return persist();
    },
    async toggleWorkspaceAlwaysOnTop() {
      snapshot = {
        ...snapshot,
        settings: {
          ...snapshot.settings,
          workspaceAlwaysOnTop: !snapshot.settings.workspaceAlwaysOnTop,
        },
      };
      return persist();
    },
    async showWorkspace() {
      window.location.href = "/";
      return true;
    },
    async showQuickPanel() {
      window.open("/?panel=quick", "_blank", "width=420,height=620");
      return true;
    },
    async hideQuickPanel() {
      window.close();
      return true;
    },
    async navigate(route) {
      window.location.href = route;
      return true;
    },
    async openExternal(urlString) {
      window.open(urlString, "_blank", "noreferrer");
      return true;
    },
    onStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function readPreviewState() {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    return raw ? JSON.parse(raw) : createPreviewState();
  } catch {
    return createPreviewState();
  }
}

function togglePreviewFlag(id, key) {
  const timestamp = new Date().toISOString();
  const current = readPreviewState();

  return {
    ...current,
    records: current.records.map((record) =>
      record.id === id
        ? {
            ...record,
            [key]: !record[key],
            updatedAt: timestamp,
          }
        : record,
    ),
    updatedAt: timestamp,
  };
}

function render() {
  app.innerHTML = isQuickPanel ? renderQuickPanel() : renderWorkspace();

  if (isQuickPanel) {
    bindQuickPanelEvents();
    return;
  }

  bindWorkspaceEvents();
}

function renderWorkspace() {
  const records = getFilteredRecords();
  const selectedRecord = findRecordById(state.selectedId) ?? records[0] ?? null;
  const clipboardRecords = state.snapshot.records.filter((record) => record.category === "clipboard").slice(0, 6);
  const stats = buildStats();
  const summaryChips = [
    state.meta?.isElectron ? "Electron 模式" : "浏览器预览",
    `快捷键 ${formatShortcut(state.meta?.shortcut ?? state.snapshot.settings.shortcut)}`,
    state.snapshot.settings.clipboardMonitoring ? "自动记录剪贴板" : "剪贴板监听已关闭",
  ];

  return `
    <main class="workspace-shell">
      <section class="workspace-hero">
        <div>
          <p class="eyebrow">Functional macOS MVP</p>
          <h1>${product.nameCn} ${product.nameEn}</h1>
          <p class="lead">${product.tagline}</p>
          <p class="lead">${product.subtitle}</p>
        </div>
        <div class="chip-row">
          ${summaryChips.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}
        </div>
      </section>

      <section class="workspace-grid">
        <aside class="workspace-sidebar">
          <article class="panel-card dark-card">
            <h2>快速动作</h2>
            <div class="action-stack">
              <button class="action-button" data-action="new-record">新建记录</button>
              <button class="action-button" data-action="capture-clipboard">捕捉当前剪贴板</button>
              <button class="action-button" data-action="show-quick-panel">打开快速面板</button>
              <button class="action-button" data-action="toggle-on-top">${state.snapshot.settings.workspaceAlwaysOnTop ? "取消工作台置顶" : "置顶工作台"}</button>
            </div>
          </article>

          <article class="panel-card">
            <h2>工作台指标</h2>
            <div class="metric-stack">
              ${stats
                .map(
                  (item) => `
                    <div class="metric-row">
                      <strong>${item.value}</strong>
                      <span>${item.label}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </article>

          <article class="panel-card">
            <h2>浮光参考摘要</h2>
            <div class="stack-list compact">
              ${fuguangSummary
                .slice(0, 3)
                .map(
                  (item) => `
                    <div class="stack-item">
                      <strong>${item.title}</strong>
                      <p>${item.body}</p>
                    </div>
                  `,
                )
                .join("")}
            </div>
            <button class="link-button" data-action="navigate" data-route="/about/">查看完整关于页</button>
          </article>
        </aside>

        <section class="workspace-main">
          <article class="panel-card composer-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Quick Capture</p>
                <h2>${state.editor.id ? "编辑当前记录" : "快速捕捉 / 新建内容"}</h2>
              </div>
              <button class="ghost-button" data-action="reset-editor">${state.editor.id ? "取消编辑" : "清空"}</button>
            </div>
            <form id="record-form" class="composer-form">
              <label class="field">
                <span>标题</span>
                <input id="editor-title" name="title" type="text" placeholder="例如：这周会议纪要 / 新灵感 / 待验证链接" value="${escapeAttribute(state.editor.title)}" />
              </label>
              <div class="form-row">
                <label class="field">
                  <span>类型</span>
                  <select id="editor-category" name="category">
                    ${renderCategoryOptions(state.editor.category)}
                  </select>
                </label>
                <label class="field">
                  <span>标签</span>
                  <input id="editor-tags" name="tags" type="text" placeholder="用逗号分隔，例如：灵感, 产品, 待办" value="${escapeAttribute(state.editor.tags)}" />
                </label>
              </div>
              <label class="field">
                <span>内容</span>
                <textarea id="editor-content" name="content" rows="8" placeholder="直接输入文本，或贴入 Markdown、链接、待办、摘录。">${escapeHtml(state.editor.content)}</textarea>
              </label>
              <div class="composer-actions">
                <button class="button primary" type="submit">${state.editor.id ? "保存修改" : "保存到本地历史"}</button>
                <button class="button secondary" type="button" data-action="capture-clipboard">从剪贴板新建</button>
              </div>
              ${state.message ? `<p class="status-note">${escapeHtml(state.message)}</p>` : ""}
            </form>
          </article>

          <article class="panel-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Search & Filter</p>
                <h2>搜索 / 筛选</h2>
              </div>
              <div class="toolbar-inline">
                <button class="tiny-button" data-action="navigate" data-route="/changelog/">changelog</button>
                <button class="tiny-button" data-action="navigate" data-route="/prototype/">prototype</button>
                <button class="tiny-button" data-action="navigate" data-route="/about/">about</button>
              </div>
            </div>
            <div class="form-row filter-row">
              <label class="field">
                <span>关键词</span>
                <input id="filter-query" type="search" placeholder="搜索标题、内容、标签" value="${escapeAttribute(state.filters.query)}" />
              </label>
              <label class="field filter-select">
                <span>类型</span>
                <select id="filter-category">
                  ${renderFilterOptions(state.filters.category)}
                </select>
              </label>
            </div>
            <p class="subtle-note">当前匹配 ${records.length} 条，本地数据位置：${escapeHtml(state.meta?.userDataPath ?? "预览模式")}</p>
          </article>

          <article class="panel-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Local History</p>
                <h2>历史内容</h2>
              </div>
              <label class="toggle-row">
                <input id="clipboard-monitoring" type="checkbox" ${state.snapshot.settings.clipboardMonitoring ? "checked" : ""} />
                <span>自动记录文本剪贴板</span>
              </label>
            </div>
            <div class="history-list">
              ${records.length ? records.map((record) => renderRecordCard(record, selectedRecord?.id)).join("") : renderEmptyState()}
            </div>
          </article>
        </section>

        <aside class="workspace-detail">
          <article class="panel-card detail-card">
            <div class="card-head">
              <div>
                <p class="eyebrow">Detail</p>
                <h2>${selectedRecord ? escapeHtml(selectedRecord.title) : "选择一条记录查看细节"}</h2>
              </div>
            </div>
            ${
              selectedRecord
                ? `
                  <div class="detail-meta">
                    <span>${labelForCategory(selectedRecord.category)}</span>
                    <span>${formatDate(selectedRecord.updatedAt)}</span>
                    <span>${selectedRecord.source === "clipboard" ? "剪贴板" : "手动创建"}</span>
                  </div>
                  <div class="detail-tags">${selectedRecord.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>
                  <div class="detail-preview ${selectedRecord.category === "markdown" ? "markdown-preview" : ""}">
                    ${
                      selectedRecord.category === "markdown"
                        ? renderMarkdown(selectedRecord.content)
                        : selectedRecord.content
                            .split("\n")
                            .map((line) => `<p>${escapeHtml(line || " ")}</p>`)
                            .join("")
                    }
                  </div>
                `
                : `<p class="empty-copy">历史记录为空时，这里会展示选中内容的详细预览。</p>`
            }
          </article>

          <article class="panel-card">
            <h2>最近剪贴板</h2>
            <div class="mini-list">
              ${clipboardRecords.length ? clipboardRecords.map(renderMiniRecord).join("") : `<p class="empty-copy">还没有收集到剪贴板文本。</p>`}
            </div>
          </article>

          <article class="panel-card">
            <h2>本轮 GEKE 已实现</h2>
            <ul class="bullet-list">
              ${implementedFeatures.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
        </aside>
      </section>
    </main>
  `;
}

function renderQuickPanel() {
  const recentRecords = state.snapshot.records.slice(0, 5);

  return `
    <main class="quick-panel-shell">
      <section class="quick-panel-card">
        <div class="quick-panel-head">
          <div>
            <p class="eyebrow">Quick Panel</p>
            <h1>${product.nameCn} ${product.nameEn}</h1>
          </div>
          <div class="toolbar-inline">
            <button class="tiny-button" data-action="show-workspace">工作台</button>
            <button class="tiny-button" data-action="hide-quick-panel">关闭</button>
          </div>
        </div>

        <form id="quick-record-form" class="composer-form compact-form">
          <label class="field">
            <span>标题</span>
            <input id="quick-title" type="text" placeholder="快速记一条" value="${escapeAttribute(state.editor.title)}" />
          </label>
          <label class="field">
            <span>类型</span>
            <select id="quick-category">
              ${renderCategoryOptions(state.editor.category)}
            </select>
          </label>
          <label class="field">
            <span>内容</span>
            <textarea id="quick-content" rows="6" placeholder="输入文字，或用下方按钮直接抓当前剪贴板">${escapeHtml(state.editor.content)}</textarea>
          </label>
          <label class="field">
            <span>标签</span>
            <input id="quick-tags" type="text" placeholder="例如：临时, 待办" value="${escapeAttribute(state.editor.tags)}" />
          </label>
          <div class="composer-actions compact-actions">
            <button class="button primary" type="submit">立即保存</button>
            <button class="button secondary" type="button" data-action="capture-clipboard">抓剪贴板</button>
          </div>
          ${state.message ? `<p class="status-note">${escapeHtml(state.message)}</p>` : ""}
        </form>

        <div class="panel-divider"></div>

        <section class="quick-panel-section">
          <div class="card-head">
            <div>
              <p class="eyebrow">Recent</p>
              <h2>最近记录</h2>
            </div>
            <span class="pill">${formatShortcut(state.meta?.shortcut ?? state.snapshot.settings.shortcut)}</span>
          </div>
          <div class="mini-list">
            ${recentRecords.map(renderMiniRecord).join("")}
          </div>
        </section>
      </section>
    </main>
  `;
}

function bindWorkspaceEvents() {
  app.querySelector("#record-form")?.addEventListener("submit", (event) => {
    void handleSave(event);
  });

  bindSharedEvents();

  app.querySelector("#filter-query")?.addEventListener("input", (event) => {
    state.filters.query = event.currentTarget.value;
    render();
  });

  app.querySelector("#filter-category")?.addEventListener("change", (event) => {
    state.filters.category = event.currentTarget.value;
    render();
  });

  app.querySelector("#clipboard-monitoring")?.addEventListener("change", async (event) => {
    const snapshot = await bridge.updateSetting({
      key: "clipboardMonitoring",
      value: event.currentTarget.checked,
    });
    state.snapshot = snapshot;
    state.message = event.currentTarget.checked ? "已开启自动剪贴板记录" : "已关闭自动剪贴板记录";
    render();
  });
}

function bindQuickPanelEvents() {
  app.querySelector("#quick-record-form")?.addEventListener("submit", (event) => {
    void handleSave(event);
  });
  bindSharedEvents();
}

function bindSharedEvents() {
  bindEditorFields();

  app.querySelectorAll("[data-record-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = findRecordById(button.dataset.recordSelect);

      if (!record) {
        return;
      }

      state.selectedId = record.id;
      syncEditorFromRecord(record);
      render();
    });
  });

  app.querySelectorAll("[data-record-copy]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const record = findRecordById(button.dataset.recordCopy);

      if (!record) {
        return;
      }

      await bridge.writeClipboardText(record.content);
      state.message = "内容已复制到剪贴板";
      render();
    });
  });

  app.querySelectorAll("[data-record-favorite]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      state.snapshot = await bridge.toggleFavorite(button.dataset.recordFavorite);
      render();
    });
  });

  app.querySelectorAll("[data-record-pin]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      state.snapshot = await bridge.togglePinned(button.dataset.recordPin);
      render();
    });
  });

  app.querySelectorAll("[data-record-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();

      if (!window.confirm("删除后不会自动恢复，继续吗？")) {
        return;
      }

      state.snapshot = await bridge.deleteRecord(button.dataset.recordDelete);

      if (state.selectedId === button.dataset.recordDelete) {
        state.selectedId = state.snapshot.records[0]?.id ?? null;
        syncEditorFromRecord(findRecordById(state.selectedId));
      }

      state.message = "记录已删除";
      render();
    });
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleAction(button.dataset.action, button.dataset.route);
    });
  });
}

function bindEditorFields() {
  const fields = [
    ["editor-title", "title"],
    ["editor-category", "category"],
    ["editor-tags", "tags"],
    ["editor-content", "content"],
    ["quick-title", "title"],
    ["quick-category", "category"],
    ["quick-tags", "tags"],
    ["quick-content", "content"],
  ];

  for (const [id, key] of fields) {
    const element = app.querySelector(`#${id}`);

    if (!element) {
      continue;
    }

    element.addEventListener("input", (event) => {
      state.editor[key] = event.currentTarget.value;
    });

    element.addEventListener("change", (event) => {
      state.editor[key] = event.currentTarget.value;
    });
  }
}

async function handleSave(event) {
  event.preventDefault();

  const payload = {
    id: state.editor.id,
    title: state.editor.title.trim(),
    content: state.editor.content.trim(),
    category: state.editor.category,
    tags: state.editor.tags,
  };

  if (!payload.content) {
    state.message = "内容不能为空";
    render();
    return;
  }

  if (payload.id) {
    state.snapshot = await bridge.updateRecord(payload);
    state.message = "修改已保存到本地";
  } else {
    state.snapshot = await bridge.createRecord(payload);
    state.selectedId = state.snapshot.records[0]?.id ?? null;
    state.message = "新记录已写入本地历史";
  }

  if (state.selectedId) {
    syncEditorFromRecord(findRecordById(state.selectedId));
  } else {
    state.editor = createEmptyEditor();
  }

  render();
}

async function handleAction(action, route) {
  switch (action) {
    case "new-record":
    case "reset-editor":
      state.selectedId = null;
      state.editor = createEmptyEditor(state.editor.category);
      state.message = "";
      render();
      return;
    case "capture-clipboard": {
      state.snapshot = await bridge.captureClipboard(true);
      state.selectedId = state.snapshot.records[0]?.id ?? null;
      syncEditorFromRecord(findRecordById(state.selectedId));
      state.message = "当前剪贴板已写入历史";
      render();
      return;
    }
    case "show-quick-panel":
      await bridge.showQuickPanel();
      return;
    case "hide-quick-panel":
      await bridge.hideQuickPanel();
      return;
    case "show-workspace":
      await bridge.showWorkspace();
      return;
    case "toggle-on-top":
      state.snapshot = await bridge.toggleWorkspaceAlwaysOnTop();
      state.message = state.snapshot.settings.workspaceAlwaysOnTop ? "工作台已置顶" : "工作台已取消置顶";
      render();
      return;
    case "navigate":
      await bridge.navigate(route);
      return;
    default:
      return;
  }
}

function syncEditorFromRecord(record) {
  if (!record) {
    state.editor = createEmptyEditor();
    return;
  }

  state.editor = {
    id: record.id,
    title: record.title,
    content: record.content,
    category: record.category,
    tags: record.tags.join(", "),
  };
}

function getFilteredRecords() {
  const query = state.filters.query.trim().toLowerCase();

  return state.snapshot.records.filter((record) => {
    const matchesCategory = state.filters.category === "all" || record.category === state.filters.category;

    if (!matchesCategory) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = `${record.title}\n${record.content}\n${record.tags.join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });
}

function buildStats() {
  const records = state.snapshot.records;

  return [
    { label: "本地历史", value: `${records.length}` },
    { label: "Markdown / 草稿", value: `${records.filter((record) => record.category === "markdown" || record.category === "draft").length}` },
    { label: "剪贴板条目", value: `${records.filter((record) => record.category === "clipboard").length}` },
    { label: "收藏 / 置顶", value: `${records.filter((record) => record.favorite || record.pinned).length}` },
  ];
}

function findRecordById(id) {
  return state.snapshot.records.find((record) => record.id === id) ?? null;
}

function renderRecordCard(record, selectedId) {
  return `
    <article class="record-card ${record.id === selectedId ? "selected" : ""}" data-record-select="${record.id}">
      <button class="record-card-main" type="button" data-record-select="${record.id}">
        <div class="record-topline">
          <span class="record-kind">${labelForCategory(record.category)}</span>
          <span class="record-time">${formatDate(record.updatedAt)}</span>
        </div>
        <h3>${escapeHtml(record.title)}</h3>
        <p>${escapeHtml(truncate(record.content, 156))}</p>
        <div class="chip-row">
          ${record.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
          ${record.favorite ? `<span class="chip accent">收藏</span>` : ""}
          ${record.pinned ? `<span class="chip accent">置顶</span>` : ""}
        </div>
      </button>
      <div class="record-actions">
        <button class="icon-button" type="button" data-record-copy="${record.id}">复制</button>
        <button class="icon-button" type="button" data-record-favorite="${record.id}">${record.favorite ? "取消收藏" : "收藏"}</button>
        <button class="icon-button" type="button" data-record-pin="${record.id}">${record.pinned ? "取消置顶" : "置顶"}</button>
        <button class="icon-button danger" type="button" data-record-delete="${record.id}">删除</button>
      </div>
    </article>
  `;
}

function renderMiniRecord(record) {
  return `
    <button class="mini-record" type="button" data-record-select="${record.id}">
      <strong>${escapeHtml(record.title)}</strong>
      <span>${escapeHtml(truncate(record.content, 68))}</span>
    </button>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <h3>还没有匹配到内容</h3>
      <p>先从快速捕捉开始，或点击“捕捉当前剪贴板”把外部文本吸进本地历史。</p>
    </div>
  `;
}

function renderCategoryOptions(selected) {
  const options = [
    ["capture", "普通记录"],
    ["draft", "草稿"],
    ["markdown", "Markdown"],
    ["link", "链接"],
    ["clipboard", "剪贴板摘录"],
  ];

  return options
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
    .join("");
}

function renderFilterOptions(selected) {
  const options = [
    ["all", "全部"],
    ["capture", "普通记录"],
    ["draft", "草稿"],
    ["markdown", "Markdown"],
    ["link", "链接"],
    ["clipboard", "剪贴板"],
  ];

  return options
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
    .join("");
}

function renderMarkdown(content) {
  const lines = content.split("\n");
  const blocks = [];
  let listBuffer = [];

  function flushList() {
    if (!listBuffer.length) {
      return;
    }

    blocks.push(`<ul>${listBuffer.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2));
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      blocks.push(`<h3>${formatInlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(`<h2>${formatInlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(`<h1>${formatInlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }

    blocks.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  }

  flushList();
  return blocks.join("");
}

function formatInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function parseTags(input) {
  return String(input ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function summarizeTitle(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 42) ?? "未命名内容";
}

function labelForCategory(category) {
  return (
    {
      capture: "记录",
      draft: "草稿",
      markdown: "Markdown",
      link: "链接",
      clipboard: "剪贴板",
    }[category] ?? "记录"
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortcut(value) {
  return value
    .replace("CommandOrControl", navigator.platform.includes("Mac") ? "⌘" : "Ctrl")
    .replace("Shift", "⇧")
    .replace(/\+/g, "");
}

function truncate(value, length) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
