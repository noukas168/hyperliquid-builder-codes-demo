/**
 * Generates the Basis brand assets into public/brand/.
 *
 * The binaries (favicon.ico, apple-touch-icon.png) cannot be hand-edited, so
 * they are generated from the same geometry constants as the SVGs and this
 * script is the record of how. Run with:
 *
 *   node scripts/generate-brand.mjs
 *
 * Rendering uses the Chromium that Playwright already installs for the test
 * suite, so this adds no dependency.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "brand");

const BRAND = "#D6362B";
/** --bs-n0, the interface's page ground. */
const GROUND = "#0A0B0D";

/**
 * The Staircase mark, on a 32-unit grid.
 *
 * Three columns of equal width on a shared baseline at y=28, rising left to
 * right in equal steps. Widths and gaps are whole units so the mark stays crisp
 * when it lands on a pixel grid at small sizes.
 *
 *   column width 6, gap 3, ink spans x 4..28
 *   heights 12, 18, 24, a 1 : 1.5 : 2 progression
 *   ink spans y 4..28, so the mark is square and optically centred
 */
const COLUMNS = [
  { x: 4, w: 6, h: 12 },
  { x: 13, w: 6, h: 18 },
  { x: 22, w: 6, h: 24 },
];
const BASELINE = 28;
const GRID = 32;

const rects = (indent) =>
  COLUMNS.map(
    ({ x, w, h }) => `${indent}<rect x="${x}" y="${BASELINE - h}" width="${w}" height="${h}" />`,
  ).join("\n");

/**
 * Squircle rather than a rounded rectangle: a superellipse, |x|^n + |y|^n = 1
 * with n = 5, which is the curve Apple's icon mask approximates. Sampled as a
 * closed polyline because the exact curve has no short Bezier form; at icon
 * sizes the sampling is far below one pixel.
 */
function squirclePath(size, n = 5, steps = 720) {
  const r = size / 2;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = Math.sign(cos) * Math.abs(cos) ** (2 / n) * r + r;
    const y = Math.sign(sin) * Math.abs(sin) ** (2 / n) * r + r;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

// ── mark.svg ──────────────────────────────────────────────────────────────
// currentColor, so wherever it is inlined it takes the colour of its context.
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" fill="currentColor" role="img" aria-labelledby="basis-mark-title">
  <title id="basis-mark-title">Basis</title>
${rects("  ")}
</svg>
`;

// ── icon.svg ──────────────────────────────────────────────────────────────
// The app icon: the mark in brand red on a near-black squircle. The mark's
// 32-unit grid is scaled 10x to 320px and centred in 512px, leaving the ink
// spanning 136..376 with even margins.
const ICON = 512;
const SCALE = 10;
const OFFSET = (ICON - GRID * SCALE) / 2;
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON} ${ICON}" role="img" aria-labelledby="basis-icon-title">
  <title id="basis-icon-title">Basis</title>
  <path d="${squirclePath(ICON)}" fill="${GROUND}" />
  <g transform="translate(${OFFSET} ${OFFSET}) scale(${SCALE})" fill="${BRAND}">
${rects("    ")}
  </g>
</svg>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "mark.svg"), markSvg);
writeFileSync(join(OUT, "icon.svg"), iconSvg);
console.log("wrote mark.svg, icon.svg");

// ── Raster ────────────────────────────────────────────────────────────────
/**
 * `opaque` fills the corners outside the squircle with the ground colour.
 * Apple applies its own mask to a touch icon, so a transparent corner there
 * would be masked twice and show through; a favicon wants the corners clear.
 */
async function render(page, size, opaque) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${opaque ? GROUND : "transparent"}">
       <div style="width:${size}px;height:${size}px">${iconSvg}</div>
     </body></html>`,
  );
  return page.screenshot({ omitBackground: !opaque });
}

/**
 * Minimal ICO writer. Each entry embeds a PNG, which every browser from Vista
 * onwards reads, and which keeps the file a fraction of the size a bitmap
 * would be.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

const icoSizes = [16, 32, 48];
const icoImages = [];
for (const size of icoSizes) {
  icoImages.push({ size, png: await render(page, size, false) });
}
writeFileSync(join(OUT, "favicon.ico"), buildIco(icoImages));
console.log(`wrote favicon.ico (${icoSizes.join(", ")}px)`);

writeFileSync(join(OUT, "apple-touch-icon.png"), await render(page, 180, true));
console.log("wrote apple-touch-icon.png (180px)");

writeFileSync(join(OUT, "icon-512.png"), await render(page, 512, false));
console.log("wrote icon-512.png");

await browser.close();
