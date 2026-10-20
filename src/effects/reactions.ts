import type { ReactionType } from '../types';

type Ctx = CanvasRenderingContext2D;

export function heartPath(ctx: Ctx, x: number, y: number, size: number): void {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.5, x, y - s * 0.55);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.5, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  ctx.closePath();
}

export function drawReactionIcon(ctx: Ctx, type: ReactionType, x: number, y: number, size: number): void {
  if (type === 'heart') {
    heartPath(ctx, x, y, size);
    ctx.fillStyle = '#ff4d79';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.stroke();
    return;
  }
  const r = size * 0.28;
  ctx.fillStyle = '#ffb3d1';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd166';
  ctx.fill();
}

interface Particle {
  type: ReactionType;
  x: number;
  y: number;
  vy: number;
  phase: number;
  age: number;
  life: number;
  size: number;
}

/** Hearts and flowers that drift upward from a krathong and fade out. */
export class ReactionParticles {
  private items: Particle[] = [];

  burst(type: ReactionType, x: number, y: number, size: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      this.items.push({
        type,
        x: x + (Math.random() - 0.5) * size,
        y: y - Math.random() * size * 0.3,
        vy: -size * (0.9 + Math.random() * 0.6),
        phase: Math.random() * Math.PI * 2,
        age: -i * 0.12,
        life: 2.4,
        size: size * (0.28 + Math.random() * 0.14),
      });
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      p.age += dt;
      if (p.age > 0) p.y += p.vy * dt;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }

  draw(ctx: Ctx): void {
    ctx.save();
    for (const p of this.items) {
      if (p.age < 0) continue;
      const k = p.age / p.life;
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      const wobble = Math.sin(p.age * 4 + p.phase) * p.size * 0.6;
      drawReactionIcon(ctx, p.type, p.x + wobble, p.y, p.size * (0.8 + 0.4 * Math.min(1, k * 4)));
    }
    ctx.restore();
  }
}
