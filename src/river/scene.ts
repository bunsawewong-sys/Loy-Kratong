import { Fireworks } from '../effects/fireworks';
import { drawReactionIcon, ReactionParticles } from '../effects/reactions';
import { drawKratong } from '../kratong/render';
import { safeParts } from '../kratong/parts';
import { maskProfanity } from '../profanity';
import type { Kratong, ReactionType } from '../types';
import { Scheduler } from './scheduler';
import { FONT, roundRect, truncate, wrapText } from './text';

type Ctx = CanvasRenderingContext2D;

export interface SceneOptions {
  /** How many krathongs float at the same time in normal rotation. */
  maxVisible: number;
  /** Automatically pop up wish bubbles (big screen). */
  autoBubbles: boolean;
  /** Seconds a krathong takes to cross the screen, [fastest, slowest]. */
  crossSeconds: [number, number];
  /** Krathong width relative to the shorter screen side. */
  sizeFactor: number;
  /** Device pixel ratio cap (lower = faster on weak devices). */
  maxDpr: number;
}

interface Floater {
  k: Kratong;
  x: number;
  depth: number;
  speed: number;
  age: number;
  seed: number;
  fresh: boolean;
  bubbleFrom: number;
  bubbleUntil: number;
  // updated every frame
  sx: number;
  sy: number;
  size: number;
}

interface Lane {
  depth: number;
  /** Seconds to cross the screen; shared by the lane so krathongs never overtake. */
  cross: number;
  last?: Floater;
}

interface Lantern {
  x: number;
  y: number;
  vy: number;
  size: number;
  phase: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  size: number;
}

const HORIZON = 0.46;

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}
const LANES = 6;

export class RiverScene {
  readonly scheduler = new Scheduler();
  readonly fireworks = new Fireworks();
  private particles = new ReactionParticles();
  private kratongs = new Map<string, Kratong>();
  private reactionCounts = new Map<string, number>();
  private pendingReactions = new Map<string, ReactionType[]>();
  private floaters: Floater[] = [];
  private lanterns: Lantern[] = [];
  private ripples: Ripple[] = [];
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private ctx: Ctx;
  private bg = document.createElement('canvas');
  private w = 0;
  private h = 0;
  private dpr = 1;
  private time = 0;
  private spawnTimer = 0;
  private spotlightTimer = 4;
  private lanternTimer = 1;
  private last = 0;
  private raf = 0;
  private highlightId?: string;
  /** Krathongs travel in depth lanes so they don't pile up on top of each other. */
  private lanes: Lane[] = [];

  /** Called when a krathong is tapped/clicked. */
  onTap?: (k: Kratong) => void;
  /** Called when a newly launched krathong appears on the river. */
  onFreshSpawn?: (k: Kratong) => void;
  /** Called when reaction particles are shown. */
  onReactionShown?: (type: ReactionType) => void;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: SceneOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const [fast, slow] = opts.crossSeconds;
    for (let i = 0; i < LANES; i++) {
      this.lanes.push({ depth: i / (LANES - 1), cross: fast + Math.random() * (slow - fast) });
    }
    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerup', (e) => this.handleTap(e));
    this.resize();
  }

  // ---------- data ----------

  setKratong(k: Kratong, fresh = false): void {
    if (k.hidden) {
      this.removeKratong(k.id);
      return;
    }
    const known = this.kratongs.has(k.id);
    this.kratongs.set(k.id, k);
    for (const f of this.floaters) if (f.k.id === k.id) f.k = k;
    if (!known) this.scheduler.add(k.id, fresh);
  }

  removeKratong(id: string): void {
    this.kratongs.delete(id);
    this.scheduler.remove(id);
    this.floaters = this.floaters.filter((f) => f.k.id !== id);
    this.pendingReactions.delete(id);
  }

  setReactionCount(id: string, count: number): void {
    this.reactionCounts.set(id, count);
  }

  get count(): number {
    return this.kratongs.size;
  }

  /** Shows hearts/flowers over a krathong, bringing it onto the river first if needed. */
  react(id: string, type: ReactionType): void {
    const f = this.floaters.find((fl) => fl.k.id === id);
    if (f) {
      this.particles.burst(type, f.sx, f.sy - f.size * 0.5, f.size);
      this.onReactionShown?.(type);
      return;
    }
    if (!this.kratongs.has(id)) return;
    const list = this.pendingReactions.get(id) ?? [];
    if (list.length < 5) list.push(type);
    this.pendingReactions.set(id, list);
    this.scheduler.prioritize(id);
  }

  /** Briefly marks one krathong (used on the phone to point at your own). */
  highlight(id: string | undefined): void {
    this.highlightId = id;
  }

  /** Spreads krathongs across the whole river at once (call after the initial load). */
  prefill(): void {
    const target = Math.min(this.opts.maxVisible, this.scheduler.size) - this.floaters.length;
    for (let i = 0; i < target; i++) {
      const lane = this.lanes[i % LANES];
      const f = this.spawn(false, lane);
      if (!f) break;
      const perLane = Math.ceil(target / LANES);
      const slot = Math.floor(i / LANES);
      // stagger lanes so krathongs don't line up in columns
      const offset = ((lane.depth * (LANES - 1) * 0.618) % 1) * 0.8;
      f.x = this.w * ((slot + offset + Math.random() * 0.2) / perLane) * 1.05 - f.size * 0.3;
      f.age = 5;
      if (!lane.last || f.x < lane.last.x) lane.last = f;
    }
  }

  // ---------- lifecycle ----------

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.maxDpr);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.fireworks.resize(this.w, this.h);
    this.stars = Array.from({ length: Math.round((this.w * this.h) / 9000) }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h * HORIZON * 0.85,
      r: Math.random() * 1.4 + 0.4,
      p: Math.random() * Math.PI * 2,
    }));
    this.renderBackground();
  }

  private handleTap(e: PointerEvent): void {
    if (!this.onTap) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const sorted = [...this.floaters].sort((a, b) => b.depth - a.depth);
    for (const f of sorted) {
      const half = f.size * 0.6;
      if (x > f.sx - half && x < f.sx + half && y > f.sy - f.size * 0.95 && y < f.sy + f.size * 0.3) {
        this.onTap(f.k);
        return;
      }
    }
  }

  // ---------- simulation ----------

  private baseSize(): number {
    return Math.min(this.w, this.h * 1.5) * this.opts.sizeFactor;
  }

  /** Room left of the most recently entered krathong in a lane (Infinity when empty). */
  private laneRoom(lane: Lane): number {
    const last = lane.last;
    if (!last || !this.floaters.includes(last)) return Infinity;
    return last.x - last.size * 0.6;
  }

  private sizeAt(depth: number): number {
    return this.baseSize() * (0.5 + 0.6 * depth);
  }

  /** The lane with the most free space at the left edge, if it has room for one more. */
  private freeLane(): Lane | undefined {
    let best = this.lanes[0];
    let bestScore = -Infinity;
    for (const lane of this.lanes) {
      const score = this.laneRoom(lane) / this.sizeAt(lane.depth);
      if (score > bestScore) {
        bestScore = score;
        best = lane;
      }
    }
    return bestScore >= 1.15 ? best : undefined;
  }

  /** Finds a spot mid-river, in one of the nearer lanes, that is clear of other krathongs. */
  private openSpot(): { lane: Lane; x: number } {
    let best = { lane: this.lanes[LANES - 1], x: this.w * 0.3 };
    let bestGap = -Infinity;
    for (let i = 0; i < 16; i++) {
      const lane = this.lanes[2 + Math.floor(Math.random() * (LANES - 2))];
      const x = this.w * (0.12 + Math.random() * 0.45);
      let gap = Infinity;
      for (const f of this.floaters) {
        const dy = Math.abs(f.depth - lane.depth) * LANES;
        gap = Math.min(gap, (Math.abs(f.x - x) / f.size) + dy);
      }
      if (gap > bestGap) {
        bestGap = gap;
        best = { lane, x };
      }
    }
    return best;
  }

  /** True when no wish bubble is currently showing near this spot. */
  private bubbleRoomAt(x: number, depth: number): boolean {
    const y = this.h * HORIZON + (this.h - this.h * HORIZON) * (0.16 + 0.62 * depth);
    return this.floaters.every(
      (a) =>
        this.time >= a.bubbleUntil ||
        Math.abs(a.sx - x) > this.w * 0.3 ||
        Math.abs(a.sy - y) > this.h * 0.25,
    );
  }

  private spawn(fromPriority: boolean, laneHint?: Lane): Floater | undefined {
    const placed = fromPriority && !laneHint ? this.openSpot() : undefined;
    const lane = laneHint ?? placed?.lane ?? this.freeLane();
    if (!lane) return undefined;
    const id = this.scheduler.next();
    if (id === undefined) return undefined;
    const k = this.kratongs.get(id)!;
    const fresh = fromPriority && !this.pendingReactions.has(id) && Date.now() - k.createdAt < 120_000;
    const depth = lane.depth;
    const cross = lane.cross;
    const size = this.sizeAt(depth);
    const f: Floater = {
      k,
      x: fresh && placed ? placed.x : -size * 0.7,
      depth,
      speed: (this.w / cross) * (0.7 + 0.5 * depth),
      age: 0,
      seed: Math.random() * 100,
      fresh,
      bubbleFrom: 0,
      bubbleUntil: 0,
      sx: 0,
      sy: 0,
      size,
    };
    if (fresh && this.opts.autoBubbles && k.wish && this.bubbleRoomAt(f.x, depth)) {
      f.bubbleFrom = this.time + 0.6;
      f.bubbleUntil = this.time + 11;
    }
    this.floaters.push(f);
    if (!placed) lane.last = f; // entered from the left edge
    this.place(f);
    if (fresh) {
      this.ripples.push({ x: f.sx, y: f.sy, age: 0, size: f.size });
      this.onFreshSpawn?.(k);
    }
    const pending = this.pendingReactions.get(id);
    if (pending) {
      this.pendingReactions.delete(id);
      pending.forEach((type, i) =>
        setTimeout(() => this.react(id, type), 700 + i * 400),
      );
    }
    return f;
  }

  private place(f: Floater): void {
    const top = this.h * HORIZON;
    const bob = Math.sin(this.time * 1.6 + f.seed) * f.size * 0.03;
    f.size = this.sizeAt(f.depth);
    f.sx = f.x;
    f.sy = top + (this.h - top) * (0.16 + 0.62 * f.depth) + bob;
  }

  private update(dt: number): void {
    this.time += dt;

    this.spawnTimer -= dt;
    const avgCross = (this.opts.crossSeconds[0] + this.opts.crossSeconds[1]) / 2;
    if (this.spawnTimer <= 0) {
      if (this.scheduler.pendingPriority > 0 && this.floaters.length < this.opts.maxVisible) {
        this.spawn(true);
        this.spawnTimer = 0.6;
      } else if (this.scheduler.pendingPriority > 0) {
        // River is full: newcomers still go first, but enter from the left in a free lane.
        const lane = this.freeLane();
        if (lane) this.spawn(true, lane);
        this.spawnTimer = 0.4;
      } else if (this.floaters.length < Math.min(this.opts.maxVisible, this.scheduler.size)) {
        this.spawn(false);
        this.spawnTimer = (avgCross / this.opts.maxVisible) * (0.3 + Math.random() * 0.4);
      }
    }

    for (const f of this.floaters) {
      f.age += dt;
      f.x += f.speed * dt;
      this.place(f);
    }
    const gone = this.floaters.filter((f) => f.x - f.size > this.w);
    for (const f of gone) this.scheduler.release(f.k.id);
    if (gone.length) this.floaters = this.floaters.filter((f) => !gone.includes(f));

    if (this.opts.autoBubbles) {
      this.spotlightTimer -= dt;
      if (this.spotlightTimer <= 0) {
        this.spotlightTimer = 5 + Math.random() * 3;
        const active = this.floaters.filter((f) => this.time < f.bubbleUntil);
        const showing = active.length;
        // Pick one far enough from the bubbles already showing so they don't overlap.
        const candidates = this.floaters.filter(
          (f) =>
            f.k.wish &&
            this.time >= f.bubbleUntil &&
            f.sx > this.w * 0.1 &&
            f.sx < this.w * 0.65 &&
            active.every((a) => Math.abs(a.sx - f.sx) > this.w * 0.3 || Math.abs(a.sy - f.sy) > this.h * 0.25),
        );
        if (showing < 3 && candidates.length) {
          const f = candidates[Math.floor(Math.random() * candidates.length)];
          f.bubbleFrom = this.time;
          f.bubbleUntil = this.time + 8;
        }
      }
    }

    this.lanternTimer -= dt;
    if (this.lanternTimer <= 0) {
      this.lanternTimer = 2.5 + Math.random() * 3;
      const size = this.baseSize() * (0.08 + Math.random() * 0.08);
      this.lanterns.push({
        x: Math.random() * this.w,
        y: this.h * HORIZON,
        vy: -this.h * (0.02 + Math.random() * 0.02),
        size,
        phase: Math.random() * 6,
      });
    }
    for (const l of this.lanterns) l.y += l.vy * dt;
    this.lanterns = this.lanterns.filter((l) => l.y > -l.size * 2);

    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < 1.6);

    this.particles.update(dt);
    this.fireworks.update(dt);
  }

  // ---------- drawing ----------

  private renderBackground(): void {
    const { w, h } = this;
    this.bg.width = Math.round(w * this.dpr);
    this.bg.height = Math.round(h * this.dpr);
    const ctx = this.bg.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);
    const horizon = h * HORIZON;

    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#191a4a');
    sky.addColorStop(0.6, '#3b2f7a');
    sky.addColorStop(1, '#6a4c9c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 2);

    // moon
    const mr = Math.min(w, h) * 0.075;
    const mx = w * 0.8;
    const my = h * 0.15;
    const glow = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2);
    glow.addColorStop(0, 'rgba(255,244,200,0.45)');
    glow.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6d5';
    ctx.fill();
    ctx.fillStyle = 'rgba(230,214,160,0.6)';
    for (const [dx, dy, r] of [[-0.35, -0.2, 0.2], [0.3, 0.25, 0.15], [0.1, -0.4, 0.1]]) {
      ctx.beginPath();
      ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // far hills
    const hill = (color: string, base: number, amp: number, freq: number, phase: number) => {
      ctx.beginPath();
      ctx.moveTo(0, horizon + 2);
      for (let x = 0; x <= w; x += 8) {
        ctx.lineTo(x, base - Math.abs(Math.sin(x * freq + phase)) * amp - Math.sin(x * freq * 2.7) * amp * 0.2);
      }
      ctx.lineTo(w, horizon + 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    hill('#3a2d6b', horizon - h * 0.02, h * 0.08, 0.004, 1);
    hill('#2a2257', horizon, h * 0.045, 0.007, 3);

    // temple (chedi) and trees on the far bank
    const s = h * 0.0018;
    const tx = w * 0.22;
    ctx.fillStyle = '#1f1946';
    ctx.beginPath();
    // tiered base, bell-shaped body and a slender spire
    ctx.moveTo(tx - 46 * s, horizon);
    ctx.lineTo(tx - 46 * s, horizon - 10 * s);
    ctx.lineTo(tx - 36 * s, horizon - 10 * s);
    ctx.lineTo(tx - 36 * s, horizon - 20 * s);
    ctx.lineTo(tx - 28 * s, horizon - 20 * s);
    ctx.bezierCurveTo(tx - 30 * s, horizon - 55 * s, tx - 8 * s, horizon - 60 * s, tx - 5 * s, horizon - 72 * s);
    ctx.lineTo(tx - 1.5 * s, horizon - 135 * s);
    ctx.lineTo(tx + 1.5 * s, horizon - 135 * s);
    ctx.lineTo(tx + 5 * s, horizon - 72 * s);
    ctx.bezierCurveTo(tx + 8 * s, horizon - 60 * s, tx + 30 * s, horizon - 55 * s, tx + 28 * s, horizon - 20 * s);
    ctx.lineTo(tx + 36 * s, horizon - 20 * s);
    ctx.lineTo(tx + 36 * s, horizon - 10 * s);
    ctx.lineTo(tx + 46 * s, horizon - 10 * s);
    ctx.lineTo(tx + 46 * s, horizon);
    ctx.closePath();
    ctx.fill();
    for (const [x, r] of [[0.05, 26], [0.11, 34], [0.34, 30], [0.42, 22], [0.58, 28], [0.66, 36], [0.93, 30]]) {
      ctx.beginPath();
      ctx.arc(w * x, horizon - r * s * 0.6, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(0, horizon - 6 * s, w, 8 * s);

    // festival string lights
    const colors = ['#ffd166', '#ff6b9a', '#7bdff2', '#95f985'];
    for (let seg = 0; seg < 4; seg++) {
      const x0 = (w / 4) * seg;
      const x1 = x0 + w / 4;
      const y0 = horizon - h * 0.05;
      for (let i = 0; i <= 12; i++) {
        const tt = i / 12;
        const x = x0 + (x1 - x0) * tt;
        const y = y0 + Math.sin(tt * Math.PI) * h * 0.025;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, h * 0.003), 0, Math.PI * 2);
        ctx.fillStyle = colors[(i + seg) % colors.length];
        ctx.fill();
      }
    }

    // water
    const water = ctx.createLinearGradient(0, horizon, 0, h);
    water.addColorStop(0, '#2c3f8f');
    water.addColorStop(1, '#0e1a47');
    ctx.fillStyle = water;
    ctx.fillRect(0, horizon, w, h - horizon);

    // lotus pads in the corners
    const pad = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.38, 0, 0.2, Math.PI * 2 - 0.2);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = '#2f8f5b';
      ctx.fill();
      ctx.strokeStyle = '#1f6b42';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    const pr = Math.min(w, h) * 0.08;
    pad(pr * 0.6, h - pr * 0.3, pr);
    pad(pr * 1.9, h - pr * 0.1, pr * 0.7);
    pad(w - pr * 0.7, h - pr * 0.25, pr * 1.1);
  }

  private draw(): void {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const horizon = h * HORIZON;

    // twinkling stars
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 0.8 + s.p));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    this.drawLanterns(ctx);
    this.fireworks.draw(ctx);

    // moon reflection and waves
    const mx = w * 0.8;
    for (let i = 0; i < 14; i++) {
      const y = horizon + 6 + i * (h - horizon) * 0.045;
      const len = (w * 0.05 + Math.sin(this.time * 2 + i) * w * 0.012) * (1 - i * 0.04);
      ctx.fillStyle = `rgba(255,240,190,${0.32 - i * 0.018})`;
      ctx.fillRect(mx - len / 2 + Math.sin(this.time * 1.3 + i * 2) * 6, y, len, 2.5);
    }
    ctx.strokeStyle = 'rgba(160,190,255,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const row = (i * 7) % 13;
      const y = horizon + (h - horizon) * (0.06 + row * 0.075);
      const x = ((i * 173 + this.time * (14 + row * 3)) % (w + 120)) - 60;
      const len = 18 + row * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - 4, x + len, y);
      ctx.stroke();
    }

    for (const r of this.ripples) {
      const k = r.age / 1.6;
      ctx.strokeStyle = `rgba(200,225,255,${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.size * (0.4 + k * 1.2), r.size * (0.1 + k * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const sorted = [...this.floaters].sort((a, b) => a.depth - b.depth);
    for (const f of sorted) this.drawFloater(ctx, f);
    // Labels go on their own layer so a krathong in front never hides a name.
    // Front krathongs claim label space first; a label that would collide is skipped
    // (it reappears as soon as its krathong drifts clear).
    const taken: DOMRect[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const f = sorted[i];
      const grow = f.fresh ? Math.min(1, f.age / 0.7) * 0.7 + 0.3 : 1;
      const box = this.labelBox(ctx, f, f.size * grow);
      const important = f.k.id === this.highlightId || this.time < f.bubbleUntil;
      if (!important && taken.some((r) => overlaps(r, box))) continue;
      taken.push(box);
      this.drawLabel(ctx, f, box);
    }
    for (const f of sorted) if (this.time >= f.bubbleFrom && this.time < f.bubbleUntil) this.drawBubble(ctx, f);
    this.particles.draw(ctx);
  }

  private drawLanterns(ctx: Ctx): void {
    for (const l of this.lanterns) {
      const x = l.x + Math.sin(this.time * 0.8 + l.phase) * l.size;
      const g = ctx.createRadialGradient(x, l.y, 0, x, l.y, l.size * 2);
      g.addColorStop(0, 'rgba(255,190,90,0.5)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - l.size * 2, l.y - l.size * 2, l.size * 4, l.size * 4);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(x - l.size * 0.45, l.y - l.size * 0.6);
      ctx.lineTo(x + l.size * 0.45, l.y - l.size * 0.6);
      ctx.lineTo(x + l.size * 0.32, l.y + l.size * 0.55);
      ctx.lineTo(x - l.size * 0.32, l.y + l.size * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff1b8';
      ctx.fillRect(x - l.size * 0.15, l.y + l.size * 0.3, l.size * 0.3, l.size * 0.2);
    }
  }

  private drawFloater(ctx: Ctx, f: Floater): void {
    const grow = f.fresh ? Math.min(1, f.age / 0.7) : 1;
    const ease = 1 - (1 - grow) ** 3;
    const size = f.size * (0.3 + 0.7 * ease);
    ctx.globalAlpha = Math.min(1, 0.3 + grow);

    // warm reflection under the flame
    ctx.fillStyle = 'rgba(255,200,110,0.16)';
    ctx.beginPath();
    ctx.ellipse(f.sx, f.sy + size * 0.12, size * 0.7, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    if (f.k.id === this.highlightId) {
      ctx.strokeStyle = `rgba(255,230,120,${0.6 + 0.4 * Math.sin(this.time * 4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(f.sx, f.sy + size * 0.05, size * 0.66, size * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawKratong(ctx, safeParts(f.k.parts), f.sx, f.sy, size, this.time, f.seed);
    ctx.globalAlpha = 1;
  }

  private labelText(f: Floater): { text: string; count: string } {
    const name = truncate(maskProfanity(f.k.name), 16);
    const dept = f.k.dept ? truncate(maskProfanity(f.k.dept), 14) : '';
    const count = this.reactionCounts.get(f.k.id) ?? 0;
    return { text: dept ? `${name} · ${dept}` : name, count: count > 0 ? String(count) : '' };
  }

  private labelBox(ctx: Ctx, f: Floater, size: number): DOMRect {
    const fs = Math.max(10, size * 0.15);
    ctx.font = `600 ${fs}px ${FONT}`;
    const { text, count } = this.labelText(f);
    const tw = ctx.measureText(text).width;
    const cw = count ? ctx.measureText(count).width + fs * 1.4 : 0;
    const pw = tw + cw + fs * 1.1;
    const ph = fs * 1.55;
    return new DOMRect(f.sx - pw / 2, f.sy + size * 0.16, pw, ph);
  }

  private drawLabel(ctx: Ctx, f: Floater, box: DOMRect): void {
    const ph = box.height;
    const fs = ph / 1.55;
    ctx.font = `600 ${fs}px ${FONT}`;
    const { text, count } = this.labelText(f);
    roundRect(ctx, box.x, box.y, box.width, ph, ph / 2);
    ctx.fillStyle = 'rgba(20,16,60,0.62)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, box.x + fs * 0.55, box.y + ph / 2);
    if (count) {
      const ix = box.x + fs * 0.55 + ctx.measureText(text).width + fs * 0.75;
      drawReactionIcon(ctx, 'heart', ix, box.y + ph / 2, fs * 0.85);
      ctx.fillStyle = '#ffd1dc';
      ctx.fillText(count, ix + fs * 0.55, box.y + ph / 2);
    }
  }

  private drawBubble(ctx: Ctx, f: Floater): void {
    const t = this.time - f.bubbleFrom;
    const left = f.bubbleUntil - this.time;
    const alpha = Math.min(1, t / 0.4, left / 0.6);
    const fs = Math.max(13, f.size * 0.17);
    ctx.font = `600 ${fs}px ${FONT}`;
    const maxW = Math.max(fs * 9, Math.min(this.w * 0.32, f.size * 3));
    const lines = wrapText(ctx, maskProfanity(f.k.wish), maxW, 3);
    if (!lines.length) return;
    const lw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const pad = fs * 0.7;
    const bw = lw + pad * 2;
    const bh = lines.length * fs * 1.45 + pad * 1.4;
    const bx = Math.min(Math.max(8, f.sx - bw / 2), this.w - bw - 8);
    const by = f.sy - f.size * 1.05 - bh - fs * 0.4 * (1 - Math.min(1, t / 0.4));
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = '#fffaf0';
    roundRect(ctx, bx, by, bw, bh, fs * 0.8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(f.sx - fs * 0.5, by + bh - 1);
    ctx.lineTo(f.sx, by + bh + fs * 0.7);
    ctx.lineTo(f.sx + fs * 0.5, by + bh - 1);
    ctx.fill();
    ctx.fillStyle = '#4a2c6e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, bx + bw / 2, by + pad * 0.8 + i * fs * 1.45));
    ctx.globalAlpha = 1;
  }
}
