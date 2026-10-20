import QRCode from 'qrcode';
import { sound } from '../audio';
import { subscribeConfig, subscribeKratongs, subscribeReactions } from '../data';
import { serverNow } from '../firebase';
import { RiverScene } from '../river/scene';

// Tunables via the URL, e.g. /screen/?max=30&qr=0
const params = new URLSearchParams(location.search);
const maxVisible = Number(params.get('max')) || 28;
const playerUrl = params.get('url') || `${location.origin}/`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const scene = new RiverScene($<HTMLCanvasElement>('river'), {
  maxVisible,
  autoBubbles: true,
  crossSeconds: [60, 95],
  sizeFactor: 0.125,
  maxDpr: 1.5,
});
scene.onFreshSpawn = () => sound.splash();
scene.onReactionShown = () => sound.chime();
scene.fireworks.onBurst = () => sound.boom();
scene.start();

// ---------- counter ----------

const countEl = $('count');
let shown = 0;
function tickCounter(): void {
  const target = scene.count;
  if (shown !== target) {
    shown += Math.sign(target - shown) * Math.max(1, Math.floor(Math.abs(target - shown) / 8));
    countEl.textContent = shown.toLocaleString('th-TH');
  }
  requestAnimationFrame(tickCounter);
}
tickCounter();

// ---------- QR ----------

if (params.get('qr') === '0') $('qr-card').hidden = true;
else
  QRCode.toCanvas($<HTMLCanvasElement>('qr'), playerUrl, {
    width: 360,
    margin: 1,
    color: { dark: '#2b1d4a', light: '#fffaf0' },
  }).catch(console.error);

// ---------- start overlay (audio needs a user gesture) ----------

$('start').addEventListener('click', () => {
  sound.unlock();
  sound.setVolume(0.8);
  sound.startMusic();
  $('start').hidden = true;
  document.documentElement.requestFullscreen?.().catch(() => undefined);
});

// ---------- data ----------

let lastFireworks = -1;

subscribeConfig((c) => {
  $('event-name').textContent = c.eventName || 'ลอยกระทง · Loy Krathong';
  document.title = c.eventName || 'ลอยกระทง';
  const logo = $<HTMLImageElement>('logo');
  logo.hidden = !c.logo;
  if (c.logo) logo.src = c.logo;
  $('closed').hidden = c.open;
  // Only react to fireworks triggered while this screen is running (not stale ones on reload).
  if (lastFireworks >= 0 && c.fireworksAt > lastFireworks && serverNow() - c.fireworksAt < 20_000) {
    scene.fireworks.show(12);
  }
  lastFireworks = c.fireworksAt || 0;
});

subscribeKratongs({
  added: (k, live) => scene.setKratong(k, live),
  changed: (k) => scene.setKratong(k),
  removed: (id) => scene.removeKratong(id),
  ready: () => scene.prefill(),
});

subscribeReactions(
  (id, byUser) => scene.setReactionCount(id, Object.keys(byUser).length),
  (id, type) => scene.react(id, type),
  (id) => scene.setReactionCount(id, 0),
);
