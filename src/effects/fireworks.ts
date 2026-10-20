type Ctx = CanvasRenderingContext2D;

const PALETTE = ['#ff6b9a', '#ffd166', '#7bdff2', '#b388ff', '#95f985', '#ff9f43', '#ffffff'];

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** Simple rocket-and-burst fireworks drawn over the sky. */
export class Fireworks {
  private rockets: Rocket[] = [];
  private sparks: Spark[] = [];
  private showUntil = 0;
  private nextLaunch = 0;
  private time = 0;
  onBurst?: () => void;

  constructor(private width = 0, private height = 0) {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  get active(): boolean {
    return this.rockets.length > 0 || this.sparks.length > 0 || this.time < this.showUntil;
  }

  /** Starts a show lasting `seconds`. */
  show(seconds = 8): void {
    this.showUntil = Math.max(this.showUntil, this.time + seconds);
    this.nextLaunch = this.time;
  }

  launch(x = this.width * (0.15 + Math.random() * 0.7)): void {
    this.rockets.push({
      x,
      y: this.height * 0.62,
      vy: -this.height * (0.75 + Math.random() * 0.25),
      targetY: this.height * (0.08 + Math.random() * 0.25),
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    });
  }

  private burst(r: Rocket): void {
    const count = 70 + Math.floor(Math.random() * 40);
    const speed = Math.min(this.width, this.height) * (0.22 + Math.random() * 0.12);
    const second = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      const v = speed * (0.55 + Math.random() * 0.45);
      const life = 1.2 + Math.random() * 0.8;
      this.sparks.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        maxLife: life,
        color: i % 3 === 0 ? second : r.color,
        size: Math.max(1.5, this.height * 0.004),
      });
    }
    this.onBurst?.();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.time < this.showUntil && this.time >= this.nextLaunch) {
      this.launch();
      if (Math.random() < 0.35) this.launch();
      this.nextLaunch = this.time + 0.35 + Math.random() * 0.6;
    }
    for (const r of this.rockets) {
      r.y += r.vy * dt;
      r.vy *= 0.985;
    }
    for (const r of this.rockets) if (r.y <= r.targetY) this.burst(r);
    this.rockets = this.rockets.filter((r) => r.y > r.targetY);

    const gravity = this.height * 0.12;
    for (const s of this.sparks) {
      s.vx *= 0.97;
      s.vy = s.vy * 0.97 + gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }

  draw(ctx: Ctx): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rockets) {
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x - 1.5, r.y, 3, 10);
    }
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
