import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(__dirname, "..");

async function assertFile(filePath, message) {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile() || info.size === 0) {
    throw new Error(message);
  }
}

await assertFile(path.join(rootDirectory, "dist", "index.html"), "dist/index.html should exist");
await assertFile(path.join(rootDirectory, "dist", "screenshot.html"), "dist/screenshot.html should exist");
await assertFile(path.join(rootDirectory, "dist", "pin.html"), "dist/pin.html should exist");

const screenshotHtml = await readFile(path.join(rootDirectory, "dist", "screenshot.html"), "utf8");
if (!screenshotHtml.includes("screenshot") || !screenshotHtml.includes("assets/")) {
  throw new Error("dist/screenshot.html should reference the screenshot bundle");
}

const pinHtml = await readFile(path.join(rootDirectory, "dist", "pin.html"), "utf8");
if (!pinHtml.includes("pin") || !pinHtml.includes("assets/")) {
  throw new Error("dist/pin.html should reference the pin bundle");
}

console.log("build output verification passed");
