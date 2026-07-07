import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const size = 36;
const pixels = Buffer.alloc(size * size * 4);

function setAlpha(x, y, alpha) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }
  const offset = (y * size + x) * 4;
  pixels[offset] = 0;
  pixels[offset + 1] = 0;
  pixels[offset + 2] = 0;
  pixels[offset + 3] = Math.max(0, Math.min(255, alpha));
}

function fillRoundedRect(left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = Math.max(left + radius - px, 0, px - (right - radius));
      const dy = Math.max(top + radius - py, 0, py - (bottom - radius));
      const cornerDistance = Math.hypot(dx, dy);
      const inside = px >= left && px <= right && py >= top && py <= bottom && cornerDistance <= radius;

      if (inside) {
        const edge = radius + 0.8 - cornerDistance;
        setAlpha(x, y, edge < 1 ? Math.round(edge * 255) : 255);
      }
    }
  }
}

function eraseRect(left, top, width, height) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      setAlpha(x, y, 0);
    }
  }
}

function eraseGlyph(pattern, left, top, scale) {
  pattern.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== "1") {
        return;
      }
      eraseRect(left + columnIndex * scale, top + rowIndex * scale, scale, scale);
    });
  });
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

const glyphG = [
  "01110",
  "10000",
  "10000",
  "10111",
  "10001",
  "10001",
  "01110",
];

const glyphK = [
  "10001",
  "10010",
  "10100",
  "11000",
  "10100",
  "10010",
  "10001",
];

fillRoundedRect(5, 5, 26, 26, 10);
eraseGlyph(glyphG, 8, 11, 2);
eraseGlyph(glyphK, 19, 11, 2);

const rows = [];
for (let y = 0; y < size; y += 1) {
  rows.push(Buffer.from([0]));
  rows.push(pixels.subarray(y * size * 4, (y + 1) * size * 4));
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

await writeFile("src-tauri/icons/menu-bar-icon.png", png);
console.log("Generated GK template menu bar icon.");
