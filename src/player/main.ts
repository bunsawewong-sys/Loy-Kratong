import { goOffline, goOnline } from 'firebase/database';
import { sound } from '../audio';
import {
  launchKratong,
  myKratongsQuery,
  recentKratongsQuery,
  type ReactionMap,
  sendReaction,
  subscribeConfig,
  subscribeKratongs,
  subscribeLastLaunch,
  subscribeReactions,
} from '../data';
import { db, ensureAnonymousUser, serverNow } from '../firebase';
import { applyI18n, getLang, onLangChange, setLang, t } from '../i18n';
import { PART_GROUPS, type PartKey, COLORS, partLabel, randomParts } from '../kratong/parts';
import { drawThumbnail, KratongPreview } from '../kratong/preview';
import { containsProfanity, maskProfanity } from '../profanity';
import { RiverScene } from '../river/scene';
import { DEFAULT_CONFIG, type EventConfig, type Kratong, type ReactionType } from '../types';
import { renderKeepsake, shareOrDownload } from './share';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const steps = ['step-name', 'step-decorate', 'step-wish', 'step-done', 'step-river'] as const;
type Step = (typeof steps)[number];

const STORE = { name: 'lk.name', dept: 'lk.dept', sound: 'lk.sound' };

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

// ---------- state ----------

let uid = '';
let config: EventConfig = DEFAULT_CONFIG;
let lastLaunchAt = 0;
let parts = randomParts();
let activeGroup: PartKey = 'base';
let lastLaunched: Kratong | undefined;
let river: RiverScene | undefined;
let sheetKratong: Kratong | undefined;
const mine = new Map<string, Kratong>();
const reactions = new Map<string, ReactionMap>();

const preview = new KratongPreview($<HTMLCanvasElement>('preview'), parts);
const launchPreview = new KratongPreview($<HTMLCanvasElement>('launch-preview'), parts);
const hero = new KratongPreview($<HTMLCanvasElement>('hero'), randomParts());

// ---------- navigation ----------

function show(step: Step): void {
  for (const s of steps) $(s).hidden = s !== step;
  $('nav-make').classList.toggle('active', step !== 'step-river');
  $('nav-river').classList.toggle('active', step === 'step-river');
  if (step === 'step-decorate') renderOptions();
  if (step === 'step-river') openRiver();
  else river?.stop();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- step 1: name ----------

const nameInput = $<HTMLInputElement>('name');
const deptInput = $<HTMLInputElement>('dept');
nameInput.value = load(STORE.name);
deptInput.value = load(STORE.dept);

$('to-decorate').addEventListener('click', () => {
  sound.unlock();
  sound.tap();
  const name = nameInput.value.trim();
  const dept = deptInput.value.trim();
  const err = $('name-error');
  if (!name) {
    err.textContent = t('nameRequired');
    nameInput.focus();
    return;
  }
  if (containsProfanity(name) || containsProfanity(dept)) {
    err.textContent = t('badWords');
    return;
  }
  err.textContent = '';
  save(STORE.name, name);
  save(STORE.dept, dept);
  show('step-decorate');
});
nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && deptInput.focus());
deptInput.addEventListener('keydown', (e) => e.key === 'Enter' && $('to-decorate').click());

// ---------- step 2: decorate ----------

function renderOptions(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.group === activeGroup);
    tab.setAttribute('aria-selected', String(tab.dataset.group === activeGroup));
  });
  const box = $('options');
  box.replaceChildren();
  PART_GROUPS[activeGroup].forEach((_, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option' + (parts[activeGroup] === i ? ' selected' : '');
    if (activeGroup === 'color') {
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = COLORS[i].petal;
      btn.append(sw);
    } else {
      const c = document.createElement('canvas');
      btn.append(c);
      requestAnimationFrame(() => drawThumbnail(c, { ...parts, [activeGroup]: i }));
    }
    const label = document.createElement('span');
    label.textContent = partLabel(activeGroup, i, getLang());
    btn.append(label);
    btn.addEventListener('click', () => {
      sound.tap();
      parts = { ...parts, [activeGroup]: i };
      preview.parts = parts;
      launchPreview.parts = parts;
      renderOptions();
    });
    box.append(btn);
  });
}

document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) =>
  tab.addEventListener('click', () => {
    sound.tap();
    activeGroup = tab.dataset.group as PartKey;
    renderOptions();
  }),
);

$('back-name').addEventListener('click', () => show('step-name'));
$('to-wish').addEventListener('click', () => {
  sound.tap();
  launchPreview.reset();
  show('step-wish');
  updateLaunchState();
});

// ---------- step 3: wish & launch ----------

const wishInput = $<HTMLTextAreaElement>('wish');
const launchBtn = $<HTMLButtonElement>('launch');
let launching = false;

wishInput.addEventListener('input', () => {
  $('wish-count').textContent = `${wishInput.value.length}/120`;
});

function cooldownLeft(): number {
  if (!lastLaunchAt) return 0;
  return Math.max(0, Math.ceil((lastLaunchAt + config.cooldownSec * 1000 - serverNow()) / 1000));
}

function formatWait(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s} ${t('seconds')}`;
}

function updateLaunchState(): void {
  const status = $('launch-status');
  const againStatus = $('again-status');
  const left = cooldownLeft();
  let msg = '';
  if (!config.open) msg = t('closed');
  else if (left > 0) msg = `${t('cooldown')} ${formatWait(left)}`;
  if (!launching) {
    status.textContent = msg;
    launchBtn.disabled = !uid || !!msg;
  }
  againStatus.textContent = msg;
}
setInterval(updateLaunchState, 1000);

$('back-decorate').addEventListener('click', () => show('step-decorate'));

launchBtn.addEventListener('click', async () => {
  sound.unlock();
  const wish = wishInput.value.trim();
  if (containsProfanity(wish)) {
    $('launch-status').textContent = t('badWords');
    return;
  }
  launching = true;
  launchBtn.disabled = true;
  launchBtn.textContent = t('launching');
  try {
    const name = load(STORE.name) || nameInput.value.trim();
    const dept = load(STORE.dept);
    const id = await launchKratong(uid, { name, dept, wish, parts });
    lastLaunched = { id, uid, name, dept, wish, parts, createdAt: serverNow() };
    sound.splash();
    launchPreview.launch(() => {
      launching = false;
      launchBtn.textContent = t('launch');
      wishInput.value = '';
      $('wish-count').textContent = '0/120';
      show('step-done');
      requestAnimationFrame(() => drawThumbnail($<HTMLCanvasElement>('done-thumb'), parts));
      updateLaunchState();
    });
  } catch (err) {
    console.error(err);
    launching = false;
    launchBtn.textContent = t('launch');
    updateLaunchState();
    if (!$('launch-status').textContent) $('launch-status').textContent = t('error');
  }
});

// ---------- step 4: done ----------

$('save').addEventListener('click', async () => {
  if (!lastLaunched) return;
  try {
    const blob = await renderKeepsake(lastLaunched, config.eventName || t('appTitle'));
    await shareOrDownload(blob, 'loy-krathong.png');
  } catch (err) {
    console.error(err);
  }
});

$('again').addEventListener('click', () => {
  parts = randomParts();
  preview.parts = parts;
  launchPreview.parts = parts;
  show('step-decorate');
});

// ---------- river ----------

function openRiver(): void {
  if (!river) {
    river = new RiverScene($<HTMLCanvasElement>('river'), {
      maxVisible: 12,
      autoBubbles: false,
      crossSeconds: [40, 60],
      sizeFactor: 0.24,
      maxDpr: 2,
    });
    river.onTap = openSheet;
    const scene = river;
    subscribeKratongs(
      {
        added: (k, live) => scene.setKratong(k, live),
        changed: (k) => scene.setKratong(k),
        removed: (id) => scene.removeKratong(id),
        ready: () => scene.prefill(),
      },
      recentKratongsQuery(60),
    );
    for (const k of mine.values()) scene.setKratong(k);
    for (const [id, map] of reactions) scene.setReactionCount(id, Object.keys(map).length);
  }
  const latest = [...mine.values()].sort((a, b) => b.createdAt - a.createdAt)[0];
  if (latest) {
    river.highlight(latest.id);
    river.scheduler.prioritize(latest.id);
  }
  river.start();
}

function renderMine(): void {
  const box = $('mine');
  box.replaceChildren();
  const list = [...mine.values()].filter((k) => !k.hidden).sort((a, b) => b.createdAt - a.createdAt);
  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = t('noKratong');
    box.append(p);
    return;
  }
  for (const k of list) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mine-card';
    const c = document.createElement('canvas');
    const wish = document.createElement('div');
    wish.textContent = k.wish ? (k.wish.length > 24 ? k.wish.slice(0, 23) + '…' : k.wish) : k.name;
    const counts = countReactions(k.id);
    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.textContent = `♥ ${counts.heart}   ❀ ${counts.flower}`;
    card.append(c, wish, stats);
    card.addEventListener('click', () => {
      river?.highlight(k.id);
      river?.scheduler.prioritize(k.id);
      openSheet(k);
    });
    box.append(card);
    requestAnimationFrame(() => drawThumbnail(c, k.parts));
  }
}

function countReactions(id: string): Record<ReactionType, number> {
  const out = { heart: 0, flower: 0 };
  for (const type of Object.values(reactions.get(id) ?? {})) out[type]++;
  return out;
}

// ---------- reaction sheet ----------

const sheet = $<HTMLDialogElement>('sheet');

function openSheet(k: Kratong): void {
  sheetKratong = k;
  $('sheet-name').textContent = maskProfanity(k.dept ? `${k.name} · ${k.dept}` : k.name);
  $('sheet-wish').textContent = maskProfanity(k.wish) || '…';
  updateSheet();
  if (!sheet.open) sheet.showModal();
  requestAnimationFrame(() => drawThumbnail($<HTMLCanvasElement>('sheet-thumb'), k.parts));
}

function updateSheet(): void {
  if (!sheetKratong) return;
  const counts = countReactions(sheetKratong.id);
  const mineReaction = reactions.get(sheetKratong.id)?.[uid];
  const own = sheetKratong.uid === uid;
  document.querySelectorAll<HTMLButtonElement>('.btn.react').forEach((btn) => {
    const type = btn.dataset.type as ReactionType;
    btn.querySelector('.count')!.textContent = String(counts[type]);
    btn.classList.toggle('done', mineReaction === type);
    btn.disabled = own || !!mineReaction;
  });
}

document.querySelectorAll<HTMLButtonElement>('.btn.react').forEach((btn) =>
  btn.addEventListener('click', async () => {
    if (!sheetKratong || !uid) return;
    const type = btn.dataset.type as ReactionType;
    sound.unlock();
    sound.chime();
    try {
      await sendReaction(sheetKratong.id, uid, type);
    } catch (err) {
      console.error(err);
    }
  }),
);

$('sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', (e) => {
  if (e.target === sheet) sheet.close();
});

// ---------- header ----------

const langBtn = $('lang-toggle');
const soundBtn = $('sound-toggle');

function refreshText(): void {
  applyI18n();
  langBtn.textContent = getLang() === 'th' ? 'EN' : 'TH';
  if (config.eventName) $('event-name').textContent = config.eventName;
  launchBtn.textContent = t(launching ? 'launching' : 'launch');
  if (!$('step-decorate').hidden) renderOptions();
  renderMine();
  updateLaunchState();
}

langBtn.addEventListener('click', () => setLang(getLang() === 'th' ? 'en' : 'th'));
onLangChange(refreshText);

sound.setVolume(0.35);
sound.setEnabled(load(STORE.sound) !== 'off');
soundBtn.setAttribute('aria-pressed', String(sound.isEnabled));
soundBtn.addEventListener('click', () => {
  sound.unlock();
  sound.setEnabled(!sound.isEnabled);
  save(STORE.sound, sound.isEnabled ? 'on' : 'off');
  soundBtn.setAttribute('aria-pressed', String(sound.isEnabled));
});

$('nav-make').addEventListener('click', () => show(lastLaunched && !launching ? 'step-decorate' : 'step-name'));
$('nav-river').addEventListener('click', () => show('step-river'));

// Release the realtime connection while the page sits in the background, so idle phones
// don't hold one of the database's concurrent connections.
let offlineTimer: number | undefined;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    offlineTimer = window.setTimeout(() => goOffline(db), 30_000);
  } else {
    window.clearTimeout(offlineTimer);
    goOnline(db);
  }
});

// ---------- boot ----------

refreshText();
void hero;

subscribeConfig((c) => {
  config = c;
  const logo = $<HTMLImageElement>('logo');
  logo.hidden = !c.logo;
  if (c.logo) logo.src = c.logo;
  document.title = c.eventName || t('appTitle');
  refreshText();
});

ensureAnonymousUser().then((user) => {
  uid = user.uid;
  updateLaunchState();
  subscribeLastLaunch(uid, (at) => {
    lastLaunchAt = at;
    updateLaunchState();
  });
  subscribeKratongs(
    {
      added: (k) => {
        mine.set(k.id, k);
        river?.setKratong(k);
        renderMine();
      },
      changed: (k) => {
        mine.set(k.id, k);
        river?.setKratong(k);
        renderMine();
      },
      removed: (id) => {
        mine.delete(id);
        renderMine();
      },
    },
    myKratongsQuery(uid),
  );
  subscribeReactions(
    (id, map) => {
      reactions.set(id, map);
      river?.setReactionCount(id, Object.keys(map).length);
      if (mine.has(id)) renderMine();
      if (sheetKratong?.id === id) updateSheet();
    },
    (id, type) => {
      river?.react(id, type);
      if (mine.has(id)) sound.chime();
    },
    (id) => {
      reactions.delete(id);
      river?.setReactionCount(id, 0);
    },
  );
});
