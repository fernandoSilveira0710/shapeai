/**
 * Gera PNGs simples 192/512 (lima + dark) sem dependências externas.
 * Node 22+ — pure buffer PNG.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/icons");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, rgbaFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = rgbaFn(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(size) {
  return png(size, (x, y, s) => {
    const cx = s / 2;
    const cy = s / 2;
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // fundo dark
    let r = 10,
      g = 10,
      b = 11,
      a = 255;
    // círculo lima
    const ring = Math.abs(dist - s * 0.32);
    if (ring < s * 0.035) {
      r = 184;
      g = 240;
      b = 0;
    }
    // check mark rough
    const t = (x + y) / s;
    if (x > s * 0.28 && x < s * 0.48 && y > s * 0.48 && y < s * 0.68) {
      if (Math.abs(y - (0.35 * s + 0.7 * (x - 0.28 * s))) < s * 0.04) {
        r = 184;
        g = 240;
        b = 0;
      }
    }
    if (x > s * 0.45 && x < s * 0.72 && y > s * 0.32 && y < s * 0.62) {
      if (Math.abs(y - (0.95 * s - 0.9 * (x - 0.28 * s))) < s * 0.04) {
        r = 184;
        g = 240;
        b = 0;
      }
    }
    // cantos arredondados mask
    const m = s * 0.18;
    if (
      (x < m && y < m && (m - x) ** 2 + (m - y) ** 2 > m * m) ||
      (x > s - m && y < m && (x - (s - m)) ** 2 + (m - y) ** 2 > m * m) ||
      (x < m && y > s - m && (m - x) ** 2 + (y - (s - m)) ** 2 > m * m) ||
      (x > s - m && y > s - m && (x - (s - m)) ** 2 + (y - (s - m)) ** 2 > m * m)
    ) {
      a = 0;
    }
    return [r, g, b, a];
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), draw(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), draw(512));
console.log("icons written");
