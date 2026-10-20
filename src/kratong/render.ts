import type { KratongParts } from '../types';
import { COLORS, type ColorOption } from './parts';

// Krathongs are drawn in "units": 100 units = the nominal width of the krathong, the
// waterline sits at y = 0 and everything above it has negative y. The static parts are
// rendered once per combination into a sprite; flames are drawn live on top every frame.

const SPRITE_LEFT = -66;
const SPRITE_TOP = -100;
const SPRITE_W = 132;
const SPRITE_H = 114;
const RES = 2.5; // sprite pixels per unit

type Ctx = CanvasRenderingContext2D;

interface Tip {
  x: number;
  y: number;
  kind: 'flame' | 'ember';
}

// ---------- small shape helpers ----------

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function fillStroke(ctx: Ctx, fill: string, stroke?: string, lw = 2): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Pointed petal growing upward from the current origin. */
function petalPath(ctx: Ctx, len: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(w, -len * 0.55, 0, -len);
  ctx.quadraticCurveTo(-w, -len * 0.55, 0, 0);
  ctx.closePath();
}

function bowlPath(ctx: Ctx, halfW: number, top: number, bottom: number): void {
  ctx.beginPath();
  ctx.moveTo(-halfW, top);
  ctx.bezierCurveTo(-halfW, bottom - 2, -halfW * 0.5, bottom, 0, bottom);
  ctx.bezierCurveTo(halfW * 0.5, bottom, halfW, bottom - 2, halfW, top);
  ctx.closePath();
}

function leaf(ctx: Ctx, x: number, y: number, rot: number, len = 22): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  petalPath(ctx, len, 9);
  fillStroke(ctx, '#4cb848', '#2d7d2a', 1.5);
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -len + 4);
  ctx.strokeStyle = '#2d7d2a';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ---------- bases ----------

function drawBase(ctx: Ctx, base: number): void {
  switch (base) {
    case 0: {
      // banana leaf with folded pleats around the rim
      for (let i = -4; i <= 4; i++) {
        const x = i * 10.5;
        const h = 14 - Math.abs(i) * 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 6.5, -20);
        ctx.lineTo(x, -22 - h);
        ctx.lineTo(x + 6.5, -20);
        ctx.closePath();
        fillStroke(ctx, i % 2 ? '#86dc5e' : '#6fcf4f', '#2f8a2a', 1.6);
      }
      bowlPath(ctx, 48, -22, 8);
      fillStroke(ctx, '#5cbf4a', '#2f8a2a', 2.5);
      ctx.strokeStyle = 'rgba(47,138,42,0.45)';
      ctx.lineWidth = 1.2;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 12, -21);
        ctx.quadraticCurveTo(i * 10, -6, i * 7, 6);
        ctx.stroke();
      }
      break;
    }
    case 1: {
      // bread
      bowlPath(ctx, 47, -20, 8);
      fillStroke(ctx, '#e8b26a', '#a8702f', 2.5);
      ellipse(ctx, 0, -20, 47, 8);
      fillStroke(ctx, '#f7d9a4', '#a8702f', 2);
      ctx.fillStyle = '#c98c45';
      for (const [x, y] of [[-30, -8], [-14, -2], [4, -6], [22, -1], [34, -9], [-24, 2], [14, 3]]) {
        ellipse(ctx, x, y, 1.6, 1.1);
        ctx.fill();
      }
      break;
    }
    case 2: {
      // lotus petals around a green cup
      bowlPath(ctx, 40, -16, 8);
      fillStroke(ctx, '#7cc96b', '#3f8f37', 2);
      for (let i = -3; i <= 3; i++) {
        ctx.save();
        ctx.translate(i * 12, -6);
        ctx.rotate(i * 0.2);
        petalPath(ctx, 30, 9);
        fillStroke(ctx, '#ffd6e7', '#e58fb3', 1.6);
        ctx.restore();
      }
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * 17, 6);
        ctx.rotate(i * 0.32);
        petalPath(ctx, 26, 10);
        fillStroke(ctx, '#fff2f8', '#e58fb3', 1.6);
        ctx.restore();
      }
      break;
    }
    case 3: {
      // coconut shell
      bowlPath(ctx, 46, -20, 10);
      fillStroke(ctx, '#9a6232', '#5e3815', 2.5);
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = -40 + ((i * 37) % 80);
        const y = -16 + ((i * 13) % 22);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 3, y + 4);
        ctx.stroke();
      }
      ellipse(ctx, 0, -20, 46, 8);
      fillStroke(ctx, '#fbf3df', '#5e3815', 2);
      ellipse(ctx, 0, -20, 39, 5.5);
      fillStroke(ctx, '#efe2c3');
      break;
    }
    default: {
      // banana trunk slice
      ctx.beginPath();
      ctx.moveTo(-46, -20);
      ctx.lineTo(-46, 2);
      ctx.bezierCurveTo(-46, 10, 46, 10, 46, 2);
      ctx.lineTo(46, -20);
      ctx.closePath();
      fillStroke(ctx, '#e3efbf', '#8fae55', 2.5);
      ctx.strokeStyle = 'rgba(143,174,85,0.5)';
      ctx.lineWidth = 1.2;
      for (let x = -36; x <= 36; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, -16);
        ctx.lineTo(x, 5);
        ctx.stroke();
      }
      ellipse(ctx, 0, -20, 46, 8);
      fillStroke(ctx, '#f5fbe2', '#8fae55', 2);
      ctx.strokeStyle = 'rgba(143,174,85,0.55)';
      for (const r of [36, 24, 12]) {
        ellipse(ctx, 0, -20, r, r * 0.17);
        ctx.stroke();
      }
    }
  }
}

function drawFace(ctx: Ctx, base: number): void {
  const y = base === 2 ? 2 : -6;
  for (const sx of [-1, 1]) {
    ellipse(ctx, sx * 12, y, 3.2, 4);
    ctx.fillStyle = '#2b1d14';
    ctx.fill();
    ellipse(ctx, sx * 12 + 1, y - 1.6, 1.1, 1.3);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ellipse(ctx, sx * 21, y + 4, 4.5, 2.6);
    ctx.fillStyle = 'rgba(255,120,150,0.55)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, y + 1.5, 4.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = '#2b1d14';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ---------- flowers ----------

function drawFlower(ctx: Ctx, type: number, x: number, y: number, r: number, c: ColorOption): void {
  ctx.save();
  ctx.translate(x, y);
  switch (type) {
    case 0: {
      // marigold: ruffled pom-pom
      for (const [ring, count, size, color] of [
        [0.72, 11, 0.38, c.petal],
        [0.42, 8, 0.33, c.dark],
      ] as const) {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          ellipse(ctx, Math.cos(a) * r * ring, Math.sin(a) * r * ring * 0.85, r * size, r * size);
          fillStroke(ctx, color, c.dark, 0.8);
        }
      }
      ellipse(ctx, 0, 0, r * 0.3, r * 0.3);
      fillStroke(ctx, c.dark);
      break;
    }
    case 1: {
      // lotus bud
      for (const a of [-0.75, 0.75, -0.38, 0.38, 0]) {
        ctx.save();
        ctx.translate(0, r * 0.7);
        ctx.rotate(a);
        petalPath(ctx, r * 1.8, r * 0.55);
        fillStroke(ctx, a === 0 ? c.petal : '#fff', c.dark, 1);
        ctx.restore();
      }
      break;
    }
    case 2: {
      // rose
      ellipse(ctx, 0, 0, r, r * 0.92);
      fillStroke(ctx, c.petal, c.dark, 1.2);
      ctx.strokeStyle = c.dark;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.75 - i * 0.22), i * 1.4, i * 1.4 + Math.PI * 1.3);
        ctx.stroke();
      }
      break;
    }
    case 3: {
      // orchid
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate((i / 5) * Math.PI * 2);
        petalPath(ctx, r * 1.05, r * 0.5);
        fillStroke(ctx, c.petal, c.dark, 1);
        ctx.restore();
      }
      ellipse(ctx, 0, r * 0.15, r * 0.35, r * 0.42);
      fillStroke(ctx, c.dark);
      ellipse(ctx, 0, -r * 0.05, r * 0.14, r * 0.14);
      fillStroke(ctx, '#ffe066');
      break;
    }
    default: {
      // jasmine: white petals, coloured centre
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ellipse(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.48, r * 0.38, a);
        fillStroke(ctx, '#ffffff', '#c9c9c9', 0.8);
      }
      ellipse(ctx, 0, 0, r * 0.28, r * 0.28);
      fillStroke(ctx, c.petal, c.dark, 0.8);
    }
  }
  ctx.restore();
}

// ---------- candles ----------

function stick(ctx: Ctx, x: number, top: number, w: number): void {
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, -34 - top, 2);
  fillStroke(ctx, '#fff7d6', '#e0bf5f', 1.5);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top - 3);
  ctx.strokeStyle = '#3b2a1a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawCandle(ctx: Ctx, candle: number): void {
  switch (candle) {
    case 0:
      ctx.strokeStyle = '#b8402f';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (const [x0, x1, y1] of [[12, 15, -80], [16, 22, -77], [20, 29, -72]]) {
        ctx.beginPath();
        ctx.moveTo(x0, -34);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      stick(ctx, -2, -64, 8);
      break;
    case 1:
      stick(ctx, 0, -76, 10);
      break;
    case 2:
      stick(ctx, -8, -68, 8);
      stick(ctx, 8, -60, 8);
      break;
    default:
      bowlPath(ctx, 11, -48, -38);
      fillStroke(ctx, '#d0773b', '#8c4a1f', 1.5);
      ellipse(ctx, 0, -48, 11, 3);
      fillStroke(ctx, '#f4c27a', '#8c4a1f', 1.2);
  }
}

function candleTips(candle: number): Tip[] {
  switch (candle) {
    case 0:
      return [
        { x: -2, y: -67, kind: 'flame' },
        { x: 15, y: -80, kind: 'ember' },
        { x: 22, y: -77, kind: 'ember' },
        { x: 29, y: -72, kind: 'ember' },
      ];
    case 1:
      return [{ x: 0, y: -79, kind: 'flame' }];
    case 2:
      return [
        { x: -8, y: -71, kind: 'flame' },
        { x: 8, y: -63, kind: 'flame' },
      ];
    default:
      return [{ x: 0, y: -50, kind: 'flame' }];
  }
}

// ---------- composition ----------

function drawStatic(ctx: Ctx, p: KratongParts): void {
  const c = COLORS[p.color] ?? COLORS[0];
  drawBase(ctx, p.base);
  leaf(ctx, -36, -22, -1.0);
  leaf(ctx, 36, -22, 1.0);
  leaf(ctx, -18, -32, -0.35, 24);
  leaf(ctx, 18, -32, 0.35, 24);
  drawFlower(ctx, p.flower, -22, -40, 9, c);
  drawFlower(ctx, p.flower, 24, -40, 9, c);
  drawCandle(ctx, p.candle);
  drawFlower(ctx, p.flower, -35, -27, 10, c);
  drawFlower(ctx, p.flower, -13, -30, 11, c);
  drawFlower(ctx, p.flower, 13, -30, 11, c);
  drawFlower(ctx, p.flower, 35, -27, 10, c);
  drawFace(ctx, p.base);
}

const spriteCache = new Map<string, HTMLCanvasElement>();

function sprite(p: KratongParts): HTMLCanvasElement {
  const key = `${p.base}-${p.flower}-${p.candle}-${p.color}`;
  let canvas = spriteCache.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = Math.ceil(SPRITE_W * RES);
    canvas.height = Math.ceil(SPRITE_H * RES);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(RES, RES);
    ctx.translate(-SPRITE_LEFT, -SPRITE_TOP);
    ctx.lineJoin = 'round';
    drawStatic(ctx, p);
    spriteCache.set(key, canvas);
  }
  return canvas;
}

function drawFlame(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  const flick = 1 + 0.12 * Math.sin(t * 11) + 0.06 * Math.sin(t * 23 + 1);
  const sway = Math.sin(t * 7) * 0.8 * s;
  const glowR = 20 * s;
  const g = ctx.createRadialGradient(x, y - 4 * s, 0, x, y - 4 * s, glowR);
  g.addColorStop(0, 'rgba(255,214,102,0.55)');
  g.addColorStop(1, 'rgba(255,214,102,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - glowR, y - 4 * s - glowR, glowR * 2, glowR * 2);

  for (const [h, w, color] of [
    [11, 4.2, '#ffa62b'],
    [7, 2.4, '#fff3b0'],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x - w * s, y);
    ctx.quadraticCurveTo(x - w * s, y - h * 0.5 * s * flick, x + sway, y - h * s * flick);
    ctx.quadraticCurveTo(x + w * s, y - h * 0.5 * s * flick, x + w * s, y);
    ctx.arc(x, y, w * s, 0, Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawEmber(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  const a = 0.6 + 0.4 * Math.sin(t * 5 + x);
  ctx.beginPath();
  ctx.arc(x, y, 1.8 * s, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,120,40,${a})`;
  ctx.fill();
}

/**
 * Draws a krathong whose waterline centre is at (x, y) and whose nominal width is `size` px.
 * `t` is the animation time in seconds; `seed` de-synchronises flames between krathongs.
 */
export function drawKratong(
  ctx: Ctx,
  p: KratongParts,
  x: number,
  y: number,
  size: number,
  t: number,
  seed = 0,
): void {
  const s = size / 100;
  ctx.drawImage(sprite(p), x + SPRITE_LEFT * s, y + SPRITE_TOP * s, SPRITE_W * s, SPRITE_H * s);
  for (const tip of candleTips(p.candle)) {
    if (tip.kind === 'flame') drawFlame(ctx, x + tip.x * s, y + tip.y * s, s, t + seed);
    else drawEmber(ctx, x + tip.x * s, y + tip.y * s, s, t + seed);
  }
}

/** Vertical extent of a krathong in units above the waterline (for hit-testing and labels). */
export const KRATONG_TOP = SPRITE_TOP + 8;
