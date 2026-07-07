import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

function createCanvas(size) {
  return {
    size,
    pixels: Buffer.alloc(size * size * 4),
  };
}

function blendPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) {
    return;
  }

  const offset = (y * canvas.size + x) * 4;
  const sourceAlpha = color[3] / 255;
  const targetAlpha = canvas.pixels[offset + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outputAlpha <= 0) {
    return;
  }

  for (let channel = 0; channel < 3; channel += 1) {
    const source = color[channel] * sourceAlpha;
    const target = canvas.pixels[offset + channel] * targetAlpha * (1 - sourceAlpha);
    canvas.pixels[offset + channel] = Math.round((source + target) / outputAlpha);
  }
  canvas.pixels[offset + 3] = Math.round(outputAlpha * 255);
}

function fillRoundedSquare(canvas) {
  const { size } = canvas;
  const inset = size * 0.055;
  const radius = size * 0.215;
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = Math.max(left + radius - px, 0, px - (right - radius));
      const dy = Math.max(top + radius - py, 0, py - (bottom - radius));
      const distance = Math.hypot(dx, dy);
      const insideRect = px >= left && px <= right && py >= top && py <= bottom;
      const coverage = insideRect ? Math.max(0, Math.min(1, radius + 1 - distance)) : 0;

      if (coverage <= 0) {
        continue;
      }

      const u = x / (size - 1);
      const v = y / (size - 1);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.28, v - 0.18) * 1.45);
      const r = Math.round(38 + 44 * u + 28 * glow);
      const g = Math.round(91 + 44 * (1 - v) + 22 * glow);
      const b = Math.round(220 + 24 * (1 - u) + 8 * glow);
      blendPixel(canvas, x, y, [r, g, b, Math.round(255 * coverage)]);
    }
  }
}

function drawLine(canvas, x1, y1, x2, y2, thickness, color) {
  const minX = Math.floor(Math.min(x1, x2) - thickness);
  const maxX = Math.ceil(Math.max(x1, x2) + thickness);
  const minY = Math.floor(Math.min(y1, y2) - thickness);
  const maxY = Math.ceil(Math.max(y1, y2) + thickness);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy || 1;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
      const nearestX = x1 + t * dx;
      const nearestY = y1 + t * dy;
      const distance = Math.hypot(px - nearestX, py - nearestY);

      if (distance <= thickness / 2 + 1) {
        const coverage = Math.max(0, Math.min(1, thickness / 2 + 1 - distance));
        blendPixel(canvas, x, y, [color[0], color[1], color[2], Math.round(color[3] * coverage)]);
      }
    }
  }
}

function drawEllipse(canvas, cx, cy, rx, ry, rotation, start, end, thickness, color) {
  const steps = Math.max(80, Math.round(canvas.size * 0.38));
  let previous = null;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let index = 0; index <= steps; index += 1) {
    const t = start + ((end - start) * index) / steps;
    const localX = Math.cos(t) * rx;
    const localY = Math.sin(t) * ry;
    const point = {
      x: cx + localX * cos - localY * sin,
      y: cy + localX * sin + localY * cos,
    };

    if (previous) {
      drawLine(canvas, previous.x, previous.y, point.x, point.y, thickness, color);
    }
    previous = point;
  }
}

function drawCircle(canvas, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius - 1);
  const maxX = Math.ceil(cx + radius + 1);
  const minY = Math.floor(cy - radius - 1);
  const maxY = Math.ceil(cy + radius + 1);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (distance <= radius + 1) {
        const coverage = Math.max(0, Math.min(1, radius + 1 - distance));
        blendPixel(canvas, x, y, [color[0], color[1], color[2], Math.round(color[3] * coverage)]);
      }
    }
  }
}

function drawRoundedRect(canvas, left, top, width, height, radius, fill, stroke = null, strokeWidth = 0) {
  const right = left + width;
  const bottom = top + height;
  const minX = Math.floor(left - strokeWidth - 2);
  const maxX = Math.ceil(right + strokeWidth + 2);
  const minY = Math.floor(top - strokeWidth - 2);
  const maxY = Math.ceil(bottom + strokeWidth + 2);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = Math.max(left + radius - px, 0, px - (right - radius));
      const dy = Math.max(top + radius - py, 0, py - (bottom - radius));
      const distance = Math.hypot(dx, dy);

      if (distance <= radius) {
        const edgeCoverage = Math.max(0, Math.min(1, radius + 1 - distance));
        blendPixel(canvas, x, y, [fill[0], fill[1], fill[2], Math.round(fill[3] * edgeCoverage)]);
      }

      if (stroke && strokeWidth > 0) {
        const strokeDistance = Math.abs(distance - radius);
        const isOnStraightEdge =
          (px >= left + radius && px <= right - radius && (Math.abs(py - top) <= strokeWidth || Math.abs(py - bottom) <= strokeWidth)) ||
          (py >= top + radius && py <= bottom - radius && (Math.abs(px - left) <= strokeWidth || Math.abs(px - right) <= strokeWidth));
        const isOnCorner = strokeDistance <= strokeWidth && distance >= radius - strokeWidth - 1;
        if (isOnStraightEdge || isOnCorner) {
          const coverage = Math.max(0, Math.min(1, strokeWidth + 1 - Math.min(strokeDistance, strokeWidth)));
          blendPixel(canvas, x, y, [stroke[0], stroke[1], stroke[2], Math.round(stroke[3] * coverage)]);
        }
      }
    }
  }
}

function drawGlow(canvas, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (distance <= radius) {
        const intensity = Math.max(0, 1 - distance / radius);
        const alpha = Math.round(color[3] * intensity * intensity);
        blendPixel(canvas, x, y, [color[0], color[1], color[2], alpha]);
      }
    }
  }
}

function drawCommandPortal(canvas) {
  const s = canvas.size;
  const glass = [244, 252, 255, 58];
  const glassHighlight = [255, 255, 255, 46];
  const cyan = [128, 227, 255, 230];
  const white = [248, 253, 255, 244];
  const deepBlue = [17, 59, 150, 225];

  drawGlow(canvas, s * 0.5, s * 0.5, s * 0.42, [210, 248, 255, 54]);
  drawRoundedRect(canvas, s * 0.18, s * 0.31, s * 0.64, s * 0.38, s * 0.09, glass, cyan, s * 0.013);
  drawRoundedRect(canvas, s * 0.205, s * 0.335, s * 0.59, s * 0.12, s * 0.055, glassHighlight);

  drawLine(canvas, s * 0.34, s * 0.43, s * 0.45, s * 0.515, s * 0.043, [8, 35, 102, 112]);
  drawLine(canvas, s * 0.34, s * 0.60, s * 0.45, s * 0.515, s * 0.043, [8, 35, 102, 112]);
  drawLine(canvas, s * 0.335, s * 0.425, s * 0.445, s * 0.51, s * 0.037, white);
  drawLine(canvas, s * 0.335, s * 0.595, s * 0.445, s * 0.51, s * 0.037, white);
  drawLine(canvas, s * 0.49, s * 0.60, s * 0.66, s * 0.60, s * 0.027, [218, 250, 255, 228]);

  drawLine(canvas, s * 0.59, s * 0.455, s * 0.70, s * 0.515, s * 0.015, deepBlue);
  drawLine(canvas, s * 0.59, s * 0.575, s * 0.70, s * 0.515, s * 0.015, deepBlue);
  for (const [x, y] of [
    [0.59, 0.455],
    [0.70, 0.515],
    [0.59, 0.575],
  ]) {
    drawGlow(canvas, s * x, s * y, s * 0.045, [255, 255, 255, 90]);
    drawCircle(canvas, s * x, s * y, s * 0.022, white);
  }
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

function encodePng(canvas) {
  const rows = [];
  for (let y = 0; y < canvas.size; y += 1) {
    rows.push(Buffer.from([0]));
    rows.push(canvas.pixels.subarray(y * canvas.size * 4, (y + 1) * canvas.size * 4));
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.size, 0);
  ihdr.writeUInt32BE(canvas.size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function writeIcon(path, size) {
  const canvas = createCanvas(size);
  fillRoundedSquare(canvas);
  drawCommandPortal(canvas);
  await writeFile(path, encodePng(canvas));
}

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="154" y1="72" x2="888" y2="946" gradientUnits="userSpaceOnUse">
      <stop stop-color="#f8fdff"/>
      <stop offset=".28" stop-color="#7ccfff"/>
      <stop offset=".68" stop-color="#1f66e9"/>
      <stop offset="1" stop-color="#0c2f9c"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="matrix(380 360 -360 380 352 258)" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity=".72"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="214" y1="320" x2="800" y2="698" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff" stop-opacity=".42"/>
      <stop offset=".46" stop-color="#e9fbff" stop-opacity=".19"/>
      <stop offset="1" stop-color="#bdefff" stop-opacity=".28"/>
    </linearGradient>
    <filter id="blur" x="130" y="250" width="764" height="540" filterUnits="userSpaceOnUse">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
    <filter id="dotGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="56" y="56" width="912" height="912" rx="220" fill="url(#bg)"/>
  <rect x="56" y="56" width="912" height="912" rx="220" fill="url(#glow)"/>
  <rect x="184" y="318" width="656" height="392" rx="92" fill="#dff8ff" opacity=".35" filter="url(#blur)"/>
  <rect x="184" y="318" width="656" height="392" rx="92" fill="url(#glass)" stroke="#7ee4ff" stroke-width="14"/>
  <path d="M218 348h588v128H218z" fill="#fff" opacity=".13"/>
  <path d="M344 438l112 82-112 82" fill="none" stroke="#fbfeff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M500 604h176" fill="none" stroke="#dafeff" stroke-width="28" stroke-linecap="round"/>
  <path d="M604 466l116 58-116 58" fill="none" stroke="#123f9d" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".84"/>
  <g filter="url(#dotGlow)" fill="#fff">
    <circle cx="604" cy="466" r="22"/>
    <circle cx="720" cy="524" r="22"/>
    <circle cx="604" cy="582" r="22"/>
  </g>
</svg>`;
}

await mkdir("build", { recursive: true });
await mkdir("src-tauri/icons", { recursive: true });
await writeFile("build/icon.svg", iconSvg());
await writeIcon("build/icon.png", 1024);
await writeIcon("src-tauri/icons/icon.png", 1024);

console.log("Generated GEKE app icons.");
