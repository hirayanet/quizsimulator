/**
 * Generator ikon PWA — tanpa dependensi (hanya zlib bawaan Node).
 * Menghasilkan PNG berisi gradien indigo + centang putih (ikon aplikasi).
 *
 * Jalankan: node scripts/generate-icons.mjs
 * Output:  public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

// ── Encoder PNG minimal ──────────────────────────────────────────────────────
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ── Gambar ───────────────────────────────────────────────────────────────────
const C1 = [0x4f, 0x46, 0xe5]; // #4f46e5 (indigo-600)
const C2 = [0x63, 0x66, 0xf1]; // #6366f1 (indigo-500)
const WHITE = [255, 255, 255];

// Titik-titik garis centang (koordinat normal 0..1)
const CHECK = [
  { ax: 0.30, ay: 0.53, bx: 0.46, by: 0.68 },
  { ax: 0.46, ay: 0.68, bx: 0.73, by: 0.34 },
];
const CHECK_THICKNESS = 0.095; // relatif terhadap ukuran

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

/**
 * @param {number} size ukuran sisi (px)
 * @param {{ rounded?: boolean; maskable?: boolean }} opts
 *   rounded: sudut melengkung (bukan untuk apple-touch-icon / maskable)
 *   maskable: latar full-bleed tanpa transparansi, konten di zona aman
 */
function renderIcon(size, { rounded = false, maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = rounded ? size * 0.22 : 0;
  const halfThick = CHECK_THICKNESS * size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // Alpha rounded-rect (sudut transparan hanya untuk ikon non-maskable)
      let alpha = 1;
      if (rounded) {
        const min = radius;
        const max = size - radius;
        const qx = px < min ? min : px > max ? max : px;
        const qy = py < min ? min : py > max ? max : py;
        alpha = Math.hypot(px - qx, py - qy) <= radius ? 1 : 0;
      }
      if (alpha === 0) continue;

      // Gradien diagonal indigo
      const t = (px / size + py / size) / 2;
      let r = Math.round(C1[0] + (C2[0] - C1[0]) * t);
      let g = Math.round(C1[1] + (C2[1] - C1[1]) * t);
      let b = Math.round(C1[2] + (C2[2] - C1[2]) * t);

      // Centang putih (dalam zona aman untuk maskable)
      const nx = px / size;
      const ny = py / size;
      let onCheck = false;
      for (const seg of CHECK) {
        if (distToSegment(nx, ny, seg.ax, seg.ay, seg.bx, seg.by) <= halfThick / size) {
          onCheck = true;
          break;
        }
      }
      if (onCheck) {
        r = WHITE[0];
        g = WHITE[1];
        b = WHITE[2];
      }

      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

// ── Output ───────────────────────────────────────────────────────────────────
const files = [
  ["icon-192.png", renderIcon(192, { rounded: true })],
  ["icon-512.png", renderIcon(512, { rounded: true })],
  ["icon-maskable-512.png", renderIcon(512, { maskable: true })],
  ["apple-touch-icon.png", renderIcon(180)], // kotak penuh (iOS membulatkan sendiri)
];

for (const [name, buf] of files) {
  const path = join(outDir, name);
  writeFileSync(path, buf);
  console.log(`✓ ${path} (${buf.length} bytes)`);
}