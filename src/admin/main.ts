import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { get, ref, remove, update } from 'firebase/database';
import { subscribeConfig, subscribeKratongs, subscribeReactions, type ReactionMap } from '../data';
import { auth, db, serverNow } from '../firebase';
import { containsProfanity } from '../profanity';
import { DEFAULT_CONFIG, type EventConfig, type Kratong } from '../types';
import { toCsv } from './csv';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const kratongs = new Map<string, Kratong>();
const reactions = new Map<string, ReactionMap>();
let config: EventConfig = DEFAULT_CONFIG;
let pendingLogo: string | undefined;
let pageSize = 100;
let started = false;

// ---------- auth ----------

auth.onAuthStateChanged(async (user) => {
  $('login').hidden = !!user;
  $('logout').hidden = !user;
  $('dashboard').hidden = true;
  $('not-admin').hidden = true;
  if (!user) return;
  const isAdmin = (await get(ref(db, `admins/${user.uid}`)).catch(() => null))?.val() === true;
  if (!isAdmin) {
    $('my-uid').textContent = user.uid;
    $('not-admin').hidden = false;
    return;
  }
  $('dashboard').hidden = false;
  start();
});

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    await signInWithEmailAndPassword(auth, $<HTMLInputElement>('email').value, $<HTMLInputElement>('password').value);
  } catch (err) {
    $('login-error').textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + (err as Error).message;
  }
});

$('logout').addEventListener('click', () => signOut(auth));

// ---------- controls ----------

function setConfig(patch: Partial<EventConfig>): Promise<void> {
  return update(ref(db, 'config'), patch);
}

// Rules require fireworksAt <= server time, so step back a little from the estimate.
const fireworksNow = () => Math.round(serverNow()) - 1000;

$('open-event').addEventListener('click', () => setConfig({ open: true, fireworksAt: fireworksNow() }));
$('close-event').addEventListener('click', () => setConfig({ open: false, fireworksAt: fireworksNow() }));
$('toggle-open').addEventListener('click', () => setConfig({ open: !config.open }));
$('fireworks').addEventListener('click', () => setConfig({ fireworksAt: fireworksNow() }));

const playerUrl = `${location.origin}/`;
$('player-url').textContent = playerUrl;

// ---------- settings ----------

function readImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function showLogo(src: string): void {
  const img = $<HTMLImageElement>('logo-preview');
  img.hidden = !src;
  $('logo-remove').hidden = !src;
  if (src) img.src = src;
}

$('logo-file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  pendingLogo = await readImage(file, 256);
  showLogo(pendingLogo);
});

$('logo-remove').addEventListener('click', () => {
  pendingLogo = '';
  $<HTMLInputElement>('logo-file').value = '';
  showLogo('');
});

$('settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = $('settings-status');
  const patch: Partial<EventConfig> = {
    eventName: $<HTMLInputElement>('event-name').value.trim(),
    cooldownSec: Math.max(0, Math.min(3600, Number($<HTMLInputElement>('cooldown').value) || 0)),
  };
  if (pendingLogo !== undefined) patch.logo = pendingLogo;
  try {
    await setConfig(patch);
    pendingLogo = undefined;
    status.textContent = 'บันทึกแล้ว';
  } catch (err) {
    status.textContent = 'บันทึกไม่สำเร็จ: ' + (err as Error).message;
  }
  setTimeout(() => (status.textContent = ''), 3000);
});

// ---------- stats & list ----------

const reactionCount = (id: string) => Object.keys(reactions.get(id) ?? {}).length;
const isFlagged = (k: Kratong) =>
  containsProfanity(k.name) || containsProfanity(k.dept ?? '') || containsProfanity(k.wish);

function renderStats(): void {
  const all = [...kratongs.values()];
  const visible = all.filter((k) => !k.hidden);
  $('st-total').textContent = String(visible.length);
  $('st-hidden').textContent = String(all.length - visible.length);
  $('st-players').textContent = String(new Set(all.map((k) => k.uid)).size);
  let totalReactions = 0;
  for (const map of reactions.values()) totalReactions += Object.keys(map).length;
  $('st-reactions').textContent = String(totalReactions);

  const byDept = new Map<string, number>();
  for (const k of visible) {
    const d = k.dept?.trim() || '(ไม่ระบุ)';
    byDept.set(d, (byDept.get(d) ?? 0) + 1);
  }
  const table = $<HTMLTableElement>('by-dept');
  table.replaceChildren();
  for (const [dept, n] of [...byDept].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    const tr = table.insertRow();
    tr.insertCell().textContent = dept;
    tr.insertCell().textContent = String(n);
  }

  const top = $('top-reacted');
  top.replaceChildren();
  for (const k of visible
    .filter((k) => reactionCount(k.id) > 0)
    .sort((a, b) => reactionCount(b.id) - reactionCount(a.id))
    .slice(0, 5)) {
    const li = document.createElement('li');
    li.textContent = `${k.name} — ${reactionCount(k.id)} ♥ — ${k.wish}`;
    top.append(li);
  }
}

function renderList(): void {
  const q = $<HTMLInputElement>('search').value.trim().toLowerCase();
  const filter = $<HTMLSelectElement>('filter').value;
  const list = [...kratongs.values()]
    .filter((k) => {
      if (filter === 'visible' && k.hidden) return false;
      if (filter === 'hidden' && !k.hidden) return false;
      if (filter === 'flagged' && !isFlagged(k)) return false;
      if (!q) return true;
      return [k.name, k.dept ?? '', k.wish].some((s) => s.toLowerCase().includes(q));
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const tbody = $<HTMLTableSectionElement>('rows');
  tbody.replaceChildren();
  for (const k of list.slice(0, pageSize)) {
    const tr = tbody.insertRow();
    tr.className = (k.hidden ? 'hidden-row ' : '') + (isFlagged(k) ? 'flagged' : '');
    tr.insertCell().textContent = new Date(k.createdAt).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    tr.insertCell().textContent = k.name;
    tr.insertCell().textContent = k.dept ?? '';
    const wish = tr.insertCell();
    wish.className = 'wish';
    wish.textContent = k.wish;
    tr.insertCell().textContent = String(reactionCount(k.id));
    const actions = tr.insertCell();
    actions.className = 'actions';
    const hide = document.createElement('button');
    hide.className = 'btn small';
    hide.textContent = k.hidden ? 'แสดง' : 'ซ่อน';
    hide.addEventListener('click', () => update(ref(db, `kratongs/${k.id}`), { hidden: !k.hidden }));
    const del = document.createElement('button');
    del.className = 'btn small';
    del.textContent = 'ลบ';
    del.addEventListener('click', async () => {
      if (!confirm(`ลบกระทงของ "${k.name}" ถาวร?`)) return;
      await remove(ref(db, `reactions/${k.id}`));
      await remove(ref(db, `kratongs/${k.id}`));
    });
    actions.append(hide, ' ', del);
  }
  $('more').hidden = list.length <= pageSize;
}

let renderQueued = false;
function scheduleRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderStats();
    renderList();
  });
}

$('search').addEventListener('input', scheduleRender);
$('filter').addEventListener('change', scheduleRender);
$('more').addEventListener('click', () => {
  pageSize += 100;
  scheduleRender();
});

$('export').addEventListener('click', () => {
  const rows = [...kratongs.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((k) => ({
      time: new Date(k.createdAt).toLocaleString('th-TH'),
      name: k.name,
      dept: k.dept ?? '',
      wish: k.wish,
      reactions: reactionCount(k.id),
      hidden: k.hidden ? 'yes' : '',
    }));
  const csv = toCsv(rows, ['time', 'name', 'dept', 'wish', 'reactions', 'hidden']);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `loy-krathong-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
});

$('reset').addEventListener('click', async () => {
  const answer = prompt('พิมพ์ RESET เพื่อยืนยันการลบข้อมูลทั้งหมด');
  if (answer !== 'RESET') return;
  await update(ref(db), { kratongs: null, reactions: null, users: null });
  alert('ลบข้อมูลเรียบร้อย');
});

// ---------- live data ----------

function start(): void {
  if (started) return;
  started = true;
  subscribeConfig((c) => {
    config = c;
    const state = $('open-state');
    state.textContent = c.open ? 'เปิดให้ลอยอยู่' : 'ปิดอยู่';
    state.className = c.open ? 'open' : 'closed';
    const nameInput = $<HTMLInputElement>('event-name');
    if (document.activeElement !== nameInput) nameInput.value = c.eventName;
    const cd = $<HTMLInputElement>('cooldown');
    if (document.activeElement !== cd) cd.value = String(c.cooldownSec);
    if (pendingLogo === undefined) showLogo(c.logo);
  });
  subscribeKratongs({
    added: (k) => {
      kratongs.set(k.id, k);
      scheduleRender();
    },
    changed: (k) => {
      kratongs.set(k.id, k);
      scheduleRender();
    },
    removed: (id) => {
      kratongs.delete(id);
      scheduleRender();
    },
  });
  subscribeReactions(
    (id, map) => {
      reactions.set(id, map);
      scheduleRender();
    },
    undefined,
    (id) => {
      reactions.delete(id);
      scheduleRender();
    },
  );
}
