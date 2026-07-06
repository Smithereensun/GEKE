import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORE_VERSION = 1;
const MAX_RECORDS = 240;
const MAX_CLIPBOARD_RECORDS = 80;

function now() {
  return new Date().toISOString();
}

function createWelcomeRecords() {
  const createdAt = now();

  return [
    {
      id: randomUUID(),
      title: "欢迎来到 GEKE 工作台",
      content:
        "这里不再是宣传页入口。你可以在这里快速捕捉、整理 Markdown 草稿、搜索历史内容，并通过菜单栏和快捷键随时调出快速面板。",
      category: "draft",
      tags: ["welcome", "workspace"],
      source: "manual",
      favorite: true,
      pinned: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: randomUUID(),
      title: "和浮光对齐的 MVP 范围",
      content:
        "本版优先实现主面板、快速捕捉、文本剪贴板历史、Markdown 草稿、搜索筛选、菜单栏入口和全局快捷键。OCR、长截图和录屏保留为后续原生能力。",
      category: "capture",
      tags: ["roadmap", "fuguang"],
      source: "manual",
      favorite: false,
      pinned: false,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function createDefaultState() {
  return {
    version: STORE_VERSION,
    records: createWelcomeRecords(),
    settings: {
      clipboardMonitoring: true,
      quickPanelAlwaysOnTop: true,
      workspaceAlwaysOnTop: false,
      shortcut: "CommandOrControl+Shift+Space",
    },
    updatedAt: now(),
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
  }

  if (typeof tags === "string") {
    return [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
  }

  return [];
}

function normalizeCategory(category) {
  const allowed = new Set(["capture", "draft", "markdown", "link", "clipboard"]);
  return allowed.has(category) ? category : "capture";
}

function summarizeTitle(content, fallback = "未命名内容") {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return fallback;
  }

  return firstLine.slice(0, 42);
}

function normalizeRecordInput(input, existingRecord = null) {
  const content = String(input.content ?? existingRecord?.content ?? "").trim();
  const title = String(input.title ?? existingRecord?.title ?? "").trim() || summarizeTitle(content);
  const category = normalizeCategory(input.category ?? existingRecord?.category);
  const tags = normalizeTags(input.tags ?? existingRecord?.tags);
  const favorite = Boolean(input.favorite ?? existingRecord?.favorite);
  const pinned = Boolean(input.pinned ?? existingRecord?.pinned);
  const source = input.source ?? existingRecord?.source ?? "manual";

  return {
    title,
    content,
    category,
    tags,
    favorite,
    pinned,
    source,
  };
}

function pruneRecords(records) {
  const clipboardRecords = records.filter((record) => record.category === "clipboard");
  const clipboardIdsToRemove = new Set(
    clipboardRecords
      .slice(MAX_CLIPBOARD_RECORDS)
      .map((record) => record.id),
  );

  return records
    .filter((record) => !clipboardIdsToRemove.has(record.id))
    .slice(0, MAX_RECORDS);
}

export class JsonWorkspaceStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = null;
  }

  async load() {
    if (this.state) {
      return this.state;
    }

    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = {
        ...createDefaultState(),
        ...parsed,
        records: Array.isArray(parsed.records) ? parsed.records : createWelcomeRecords(),
        settings: {
          ...createDefaultState().settings,
          ...(parsed.settings ?? {}),
        },
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      this.state = createDefaultState();
      await this.save();
    }

    return this.state;
  }

  async save() {
    if (!this.state) {
      this.state = createDefaultState();
    }

    this.state.updatedAt = now();
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  snapshot() {
    return structuredClone(this.state);
  }

  async mutate(mutator) {
    await this.load();
    mutator(this.state);
    this.state.records = pruneRecords(
      [...this.state.records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
    await this.save();
    return this.snapshot();
  }

  async addRecord(input) {
    return this.mutate((state) => {
      const normalized = normalizeRecordInput(input);
      const timestamp = now();

      state.records.unshift({
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...normalized,
      });
    });
  }

  async updateRecord(id, patch) {
    return this.mutate((state) => {
      const index = state.records.findIndex((record) => record.id === id);

      if (index === -1) {
        return;
      }

      const current = state.records[index];
      const normalized = normalizeRecordInput(patch, current);

      state.records[index] = {
        ...current,
        ...normalized,
        updatedAt: now(),
      };
    });
  }

  async removeRecord(id) {
    return this.mutate((state) => {
      state.records = state.records.filter((record) => record.id !== id);
    });
  }

  async toggleRecordFlag(id, flag) {
    return this.mutate((state) => {
      state.records = state.records.map((record) =>
        record.id === id
          ? {
              ...record,
              [flag]: !record[flag],
              updatedAt: now(),
            }
          : record,
      );
    });
  }

  async captureClipboard(text, force = false) {
    const trimmed = String(text ?? "").trim();

    if (!trimmed) {
      return this.snapshot();
    }

    return this.mutate((state) => {
      const newestClipboard = state.records.find((record) => record.category === "clipboard");

      if (!force && newestClipboard?.content === trimmed) {
        return;
      }

      const timestamp = now();

      state.records.unshift({
        id: randomUUID(),
        title: summarizeTitle(trimmed, "剪贴板"),
        content: trimmed,
        category: "clipboard",
        tags: ["clipboard"],
        source: "clipboard",
        favorite: false,
        pinned: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  }

  async updateSetting(key, value) {
    return this.mutate((state) => {
      state.settings[key] = value;
    });
  }
}
