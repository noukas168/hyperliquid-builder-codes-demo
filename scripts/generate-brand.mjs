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
 * The Spread mark, on a 32-unit grid.
 *
 * Two horizontal rounded bars of equal size, offset both across and down, so
 * the negative space between them steps diagonally. The gap is the mark: it is
 * sized to survive a 16px favicon rather than to look best at 512px.
 *
 *   bar 20 x 4, corner radius 1
 *   upper bar at x=4, lower at x=8, a 4-unit offset, 0.2 of the bar width
 *   bars at y=10 and y=18, leaving a 4-unit gap
 *   ink spans x 4..28 and y 10..22, centred on the 32-unit canvas
 *
 * Every coordinate is even. A 32-unit grid halves to 16px, so even units land
 * on whole pixels and the bar edges stay hard at favicon size; the gap renders
 * a clean 2px there. The reference geometry, 140 x 28 at radius 6 on a 256
 * canvas, maps to 17.5 x 3.5 at radius 0.75 here, which would put every edge on
 * a half pixel. The proportions below keep its 0.2 offset-to-width ratio and
 * its roughly quarter-height corner radius while snapping to the grid.
 */
const BARS = [
  { x: 4, y: 10 },
  { x: 8, y: 18 },
];
const BAR_W = 20;
const BAR_H = 4;
const BAR_R = 1;
const GRID = 32;

const rects = (indent) =>
  BARS.map(
    ({ x, y }) =>
      `${indent}<rect x="${x}" y="${y}" width="${BAR_W}" height="${BAR_H}" rx="${BAR_R}" />`,
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
/**
 * The app icon: the mark in brand red on a near-black squircle.
 *
 * `scale` sets how much of the 512 canvas the mark's 32-unit grid covers, and
 * it is not one value for every size. Optical sizing: a large icon wants air
 * around the mark, a 16px favicon wants none, and more than that, a favicon
 * wants its edges on whole pixels.
 *
 * Rendering 512 down to 16 divides by 32, so a mark unit becomes scale/32 of a
 * pixel. At scale 10 a 4-unit bar lands on 1.25px, which is why the bars and
 * the gap between them go soft: the grid's even units buy nothing once the
 * icon is scaled by a non-multiple. Only a scale that is a multiple of 16
 * keeps even units on whole pixels, and 16 is the one that also leaves the
 * mark's own 4-unit inset as the icon's margin.
 */
const ICON = 512;
const DISPLAY_SCALE = 10; // large sizes: mark covers 320 of 512, with air
const FAVICON_SCALE = 16; // 16px rasters: 4-unit bar lands on exactly 2px

function iconSvgAt(scale) {
  const offset = (ICON - GRID * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON} ${ICON}" role="img" aria-labelledby="basis-icon-title">
  <title id="basis-icon-title">Basis</title>
  <path d="${squirclePath(ICON)}" fill="${GROUND}" />
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="${BRAND}">
${rects("    ")}
  </g>
</svg>
`;
}

const iconSvg = iconSvgAt(DISPLAY_SCALE);

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
async function render(page, size, opaque, svg = iconSvg) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${opaque ? GROUND : "transparent"}">
       <div style="width:${size}px;height:${size}px">${svg}</div>
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

const faviconSvg = iconSvgAt(FAVICON_SCALE);
const icoSizes = [16, 32, 48];
const icoImages = [];
for (const size of icoSizes) {
  icoImages.push({ size, png: await render(page, size, false, faviconSvg) });
}
const ico = buildIco(icoImages);
writeFileSync(join(OUT, "favicon.ico"), ico);
// Also at the web root. The metadata link is what browsers follow, but
// crawlers and feed readers still request /favicon.ico directly, and without
// this that request 404s.
writeFileSync(join(ROOT, "public", "favicon.ico"), ico);
console.log(`wrote favicon.ico and /favicon.ico (${icoSizes.join(", ")}px)`);

writeFileSync(join(OUT, "apple-touch-icon.png"), await render(page, 180, true));
console.log("wrote apple-touch-icon.png (180px)");

writeFileSync(join(OUT, "icon-512.png"), await render(page, 512, false));
console.log("wrote icon-512.png");

await browser.close();
