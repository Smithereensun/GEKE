import { cp, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const root = process.cwd();
const releaseDir = join(root, "release");
const bundleDir = join(root, "src-tauri", "target", "release", "bundle");
const appSource = join(bundleDir, "macos", "极刻 GEKE.app");
const dmgSource = join(bundleDir, "dmg", "极刻 GEKE_1.0.0_aarch64.dmg");
const appTarget = join(releaseDir, "极刻 GEKE.app");
const signingIdentity = process.env.GEKE_CODESIGN_IDENTITY || "-";
const signingRequirements = process.env.GEKE_CODESIGN_REQUIREMENTS || '=designated => identifier "com.smithereensun.geke"';

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
await cp(appSource, appTarget, { recursive: true });
await cp(dmgSource, join(releaseDir, "极刻 GEKE_1.0.0_aarch64.dmg"));
await run("codesign", ["--force", "--deep", "--sign", signingIdentity, "--requirements", signingRequirements, appTarget]);

console.log(`Copied and signed Tauri bundles to release/ with ${signingIdentity === "-" ? "ad-hoc signing" : signingIdentity}.`);
