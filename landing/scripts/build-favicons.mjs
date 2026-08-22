/**
 * Raster favicon pack from public/favicon.svg (SSOT).
 * Run from landing/: `node scripts/build-favicons.mjs`
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const landingDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(landingDir, "public");
const svgPath = path.join(publicDir, "favicon.svg");

const PNG_TARGETS = [
  { file: "favicon-48x48.png", size: 48 },
  { file: "favicon-96x96.png", size: 96 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];

const ICO_SIZES = [16, 32, 48];

function svgAtSize(svgSource, size) {
  return Buffer.from(
    svgSource.replace('width="32"', `width="${size}"`).replace('height="32"', `height="${size}"`),
  );
}

async function rasterPng(svgSource, size) {
  return sharp(svgAtSize(svgSource, size)).png({ compressionLevel: 9 }).toBuffer();
}

function encodeIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + 16 * count;
  const entries = [];
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.width >= 256 ? 0 : image.width;
    entry[1] = image.height >= 256 ? 0 : image.height;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += image.data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const svgSource = await readFile(svgPath, "utf8");

for (const target of PNG_TARGETS) {
  const png = await rasterPng(svgSource, target.size);
  await writeFile(path.join(publicDir, target.file), png);
}

const icoImages = [];
for (const size of ICO_SIZES) {
  icoImages.push({ width: size, height: size, data: await rasterPng(svgSource, size) });
}
await writeFile(path.join(publicDir, "favicon.ico"), encodeIco(icoImages));

console.log(
  `Wrote ${PNG_TARGETS.map((t) => t.file).join(", ")} and favicon.ico (${ICO_SIZES.join("/")} PNG)`,
);
