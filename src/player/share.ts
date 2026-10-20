import { drawKratong } from '../kratong/render';
import { safeParts } from '../kratong/parts';
import { FONT, roundRect, wrapText } from '../river/text';
import type { Kratong } from '../types';

/** Builds a 1080x1350 keepsake image of a krathong with its wish. */
export async function renderKeepsake(k: Kratong, eventName: string): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#191a4a');
  sky.addColorStop(0.5, '#4a3688');
  sky.addColorStop(0.52, '#2c3f8f');
  sky.addColorStop(1, '#0e1a47');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + ((i * 37) % 70) / 100})`;
    const s = 1 + (i % 3);
    ctx.fillRect((i * 397) % W, (i * 211) % 640, s, s);
  }
  const glow = ctx.createRadialGradient(840, 180, 60, 840, 180, 260);
  glow.addColorStop(0, 'rgba(255,244,200,0.5)');
  glow.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(540, 0, 540, 480);
  ctx.beginPath();
  ctx.arc(840, 180, 80, 0, Math.PI * 2);
  ctx.fillStyle = '#fff6d5';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 64px ${FONT}`;
  ctx.fillText(eventName || 'Loy Krathong', W / 2, 70, W - 120);

  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(255,240,190,${0.3 - i * 0.025})`;
    ctx.fillRect(840 - 50 + (i % 2) * 10, 720 + i * 22, 100 - i * 6, 4);
  }
  drawKratong(ctx, safeParts(k.parts), W / 2, 790, 560, 0.4);

  ctx.font = `700 52px ${FONT}`;
  ctx.fillStyle = '#ffe9a8';
  const who = k.dept ? `${k.name} · ${k.dept}` : k.name;
  ctx.fillText(who, W / 2, 860, W - 120);

  if (k.wish) {
    ctx.font = `600 44px ${FONT}`;
    const lines = wrapText(ctx, k.wish, W - 260, 4);
    const boxH = lines.length * 62 + 70;
    roundRect(ctx, 90, 960, W - 180, boxH, 36);
    ctx.fillStyle = 'rgba(255,250,240,0.95)';
    ctx.fill();
    ctx.fillStyle = '#4a2c6e';
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 995 + i * 62));
  }

  ctx.font = `600 32px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const date = new Date(k.createdAt || Date.now()).toLocaleDateString('th-TH', { dateStyle: 'long' });
  ctx.fillText(date, W / 2, H - 70);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

/** Opens the share sheet when the browser supports sharing files, otherwise downloads. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
