// Genereert het "2.0"-logo (SVG) en alle PWA-iconen (PNG).
// Gebruik: npm run icons
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fontFile = require.resolve("@fontsource/inter/files/inter-latin-900-normal.woff");
const buf = fs.readFileSync(fontFile);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

/** "2.0" als pad, gecentreerd rond (cx, cy) met gegeven cap-hoogte. */
function textPath(text, cx, cy, height, tracking = -0.04) {
  const size = height / (font.tables.os2.sCapHeight / font.unitsPerEm);
  const glyphs = [...text].map((ch) => font.charToGlyph(ch));
  let x = 0;
  const parts = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    parts.push({ g, x });
    x += (g.advanceWidth / font.unitsPerEm) * size + tracking * size;
    if (i < glyphs.length - 1) x += (font.getKerningValue(g, glyphs[i + 1]) / font.unitsPerEm) * size;
  }
  const width = x - tracking * size;
  const baseline = cy + height / 2;
  const d = parts.map(({ g, x: gx }) => g.getPath(cx - width / 2 + gx, baseline, size).toPathData(2)).join("");
  return d;
}

function logoSvg({ size = 512, background = true, safe = 1 } = {}) {
  const c = 256;
  const r = 180 * safe;
  const stroke = 30 * safe;
  const progress = 0.74;
  const a = -Math.PI / 2 + progress * 2 * Math.PI;
  const end = [c + r * Math.cos(a), c + r * Math.sin(a)];
  const arc = `M ${c} ${c - r} A ${r} ${r} 0 ${progress > 0.5 ? 1 : 0} 1 ${end[0].toFixed(2)} ${end[1].toFixed(2)}`;
  const text = textPath("2.0", c, c, 122 * safe, -0.055);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="30%" cy="18%" r="95%">
      <stop offset="0" stop-color="#16244A"/>
      <stop offset="0.55" stop-color="#0A1022"/>
      <stop offset="1" stop-color="#05070D"/>
    </radialGradient>
    <linearGradient id="ring" gradientUnits="userSpaceOnUse" x1="${c + r}" y1="${c - r}" x2="${c - r}" y2="${c + r * 0.2}">
      <stop offset="0" stop-color="#1D4ED8"/>
      <stop offset="0.55" stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#93C5FD"/>
    </linearGradient>
    <linearGradient id="txt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#BFDBFE"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${12 * safe}"/>
    </filter>
  </defs>
  ${background ? `<rect width="512" height="512" fill="url(#bg)"/>` : ""}
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="${stroke}"/>
  <path d="${arc}" fill="none" stroke="url(#ring)" stroke-width="${stroke}" stroke-linecap="round" opacity="0.6" filter="url(#glow)"/>
  <path d="${arc}" fill="none" stroke="url(#ring)" stroke-width="${stroke}" stroke-linecap="round"/>
  <circle cx="${end[0].toFixed(2)}" cy="${end[1].toFixed(2)}" r="${(stroke * 0.3).toFixed(1)}" fill="#FFFFFF"/>
  <path d="${text}" fill="url(#txt)"/>
</svg>`;
}

function png(svg, size, out) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  fs.writeFileSync(path.join(root, out), r.render().asPng());
  console.log("✓", out);
}

const full = logoSvg();
fs.writeFileSync(path.join(root, "public/logo.svg"), full);
fs.writeFileSync(path.join(root, "src/assets/logo-mark.svg"), logoSvg({ background: false }));
console.log("✓ public/logo.svg, src/assets/logo-mark.svg");

png(full, 180, "public/icons/apple-touch-icon.png");
png(full, 192, "public/icons/icon-192.png");
png(full, 512, "public/icons/icon-512.png");
png(logoSvg({ safe: 0.78 }), 512, "public/icons/maskable-512.png");
png(full, 64, "public/favicon-64.png");

// Monochrome badge (Android statusbalk)
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${textPath("2.0", 256, 256, 200)}" fill="#fff"/></svg>`;
png(badge, 96, "public/icons/badge-96.png");
