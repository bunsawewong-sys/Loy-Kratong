import type { KratongParts } from '../types';
import { drawKratong } from './render';

type Ctx = CanvasRenderingContext2D;

/** Draws a krathong bobbing on a small patch of water. Used for the editor preview. */
export class KratongPreview {
  private ctx: Ctx;
  private raf = 0;
  private start = performance.now();
  /** 0 = resting; > 0 animates the krathong drifting away (launch). */
  private launchAt = 0;
  private onLaunched?: () => void;

  constructor(
    private canvas: HTMLCanvasElement,
    public parts: KratongParts,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  launch(done: () => void): void {
    this.launchAt = performance.now();
    this.onLaunched = done;
  }

  reset(): void {
    this.launchAt = 0;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  private loop(now: number): void {
    const { canvas, ctx } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = (now - this.start) / 1000;
    const waterY = h * 0.72;

    const water = ctx.createLinearGradient(0, waterY - 10, 0, h);
    water.addColorStop(0, '#3c56b0');
    water.addColorStop(1, '#1b2a6b');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let x = 0; x <= w; x += 10) ctx.lineTo(x, waterY + Math.sin(x * 0.04 + t * 2) * 3);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    let size = Math.min(w * 0.62, h * 0.78);
    let x = w / 2;
    let y = waterY + 6 + Math.sin(t * 1.8) * 3;
    let alpha = 1;
    if (this.launchAt) {
      const k = Math.min(1, (now - this.launchAt) / 2200);
      const e = k * k;
      x += e * w * 0.15;
      y -= e * h * 0.12;
      size *= 1 - e * 0.75;
      alpha = 1 - Math.max(0, (k - 0.6) / 0.4);
      // ripple at the launch point
      ctx.strokeStyle = `rgba(210,230,255,${0.8 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w / 2, waterY + 8, size * (0.5 + k), size * (0.12 + k * 0.2), 0, 0, Math.PI * 2);
      ctx.stroke();
      if (k >= 1 && this.onLaunched) {
        const cb = this.onLaunched;
        this.onLaunched = undefined;
        cb();
      }
    }
    ctx.globalAlpha = alpha;
    drawKratong(ctx, this.parts, x, y, size, t);
    ctx.globalAlpha = 1;
    this.raf = requestAnimationFrame(this.loop);
  }
}

/** Renders a still krathong into a small canvas (used for option thumbnails). */
export function drawThumbnail(canvas: HTMLCanvasElement, parts: KratongParts): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 72;
  const h = canvas.clientHeight || 64;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const size = Math.min(w * 0.78, h * 0.95);
  drawKratong(ctx, parts, w / 2, h * 0.82, size, 0.3);
}
