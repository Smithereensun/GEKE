import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const root = process.cwd();
const levels = [
  { label: "15-16", value: 2013265964 },
  { label: "31-32", value: 2080374796 },
  { label: "63-64", value: 2113929212 },
  { label: "127-128", value: 2130706420 },
  { label: "255-256", value: 2139095024 },
];
const variantsDir = join(root, "release", "screenshot-levels");
const appSource = join(root, "src-tauri", "target", "release", "bundle", "macos", "极刻 GEKE.app");
const signingIdentity = process.env.GEKE_CODESIGN_IDENTITY || "-";
const signingRequirements = process.env.GEKE_CODESIGN_REQUIREMENTS || '=designated => identifier "com.smithereensun.geke"';

await rm(variantsDir, { recursive: true, force: true });
await mkdir(variantsDir, { recursive: true });
await run("npm", ["run", "build"], { cwd: root });

const config = JSON.stringify({ build: { beforeBuildCommand: "" }, bundle: { targets: ["app"] } });

for (const level of levels) {
  console.log(`Building screenshot overlay level ${level.value} (${level.label})...`);
  await run(
    join(root, "node_modules", ".bin", "tauri"),
    ["build", "--bundles", "app", "--config", config],
    {
      cwd: root,
      env: {
        ...process.env,
        GEKE_SCREENSHOT_OVERLAY_LEVEL: String(level.value),
      },
    },
  );

  const targetDir = join(variantsDir, `${level.label}-${level.value}`);
  const appTarget = join(targetDir, "极刻 GEKE.app");
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(appSource, appTarget, { recursive: true });
  await run("codesign", ["--force", "--deep", "--sign", signingIdentity, "--requirements", signingRequirements, appTarget]);
}

await writeFile(
  join(variantsDir, "README.md"),
  [
    "# Screenshot Level Test Builds",
    "",
    "按顺序测试下面这些包。测试下一个之前先退出当前运行的极刻。",
    "",
    ...levels.map((level, index) => `${index + 1}. ${level.label}-${level.value}/极刻 GEKE.app`),
    "",
  ].join("\n"),
);

console.log(`Built ${levels.length} screenshot level variants in ${variantsDir}`);
