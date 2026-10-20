// Seeds the local Firebase Emulator with config, an admin account and demo krathongs.
//
//   npm run seed                        # config + admin (admin@example.com / admin1234)
//   npm run seed -- --kratongs 300      # plus 300 demo krathongs
//   npm run seed -- --live 500 --over 60  # trickle 500 krathongs in over 60 s (load test)
//
// Only talks to the emulator (127.0.0.1); it never touches a real Firebase project.

const DB = 'http://127.0.0.1:9000';
const NS = 'demo-loy-kratong-default-rtdb';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};

async function db(method, path, body) {
  const res = await fetch(`${DB}/${path}.json?ns=${NS}`, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ensureAdmin(email, password) {
  const call = (op) =>
    fetch(`${AUTH}/accounts:${op}?key=demo-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }).then((r) => r.json());
  let res = await call('signUp');
  if (res.error) res = await call('signInWithPassword');
  if (!res.localId) throw new Error('Could not create admin: ' + JSON.stringify(res));
  await db('PUT', `admins/${res.localId}`, true);
  return res.localId;
}

const NAMES = ['กอล์ฟ', 'มายด์', 'บอส', 'แนน', 'ต้น', 'ปุ้ย', 'เจมส์', 'ฝน', 'Alex', 'Mint', 'Ploy', 'Ton', 'Beam', 'น้ำ', 'ออม'];
const DEPTS = ['Network', 'IT Support', 'HR', 'Finance', 'Sales', 'Marketing', '', ''];
const WISHES = [
  'ขอให้ทุกคนสุขภาพแข็งแรง',
  'ขอให้ได้โบนัสเยอะๆ',
  'ขอให้งานราบรื่น ไม่มี incident',
  'ขอให้ network ไม่ล่มตลอดปี',
  'ขอให้ครอบครัวมีความสุข',
  'ขอให้ได้เที่ยวญี่ปุ่น',
  'May everyone be happy and healthy',
  'Wishing for a peaceful new year',
  'ขอให้สอบผ่าน',
  '',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randParts = () => ({
  base: Math.floor(Math.random() * 5),
  flower: Math.floor(Math.random() * 5),
  candle: Math.floor(Math.random() * 4),
  color: Math.floor(Math.random() * 6),
});

function demoKratong(i) {
  const k = {
    uid: `demo-user-${i % 400}`,
    name: pick(NAMES),
    wish: pick(WISHES),
    parts: randParts(),
    createdAt: Date.now() - Math.floor(Math.random() * 3_600_000),
  };
  const dept = pick(DEPTS);
  if (dept) k.dept = dept;
  return k;
}

const existing = await db('GET', 'config');
await db('PATCH', 'config', {
  eventName: existing?.eventName ?? 'ลอยกระทง 2569',
  logo: existing?.logo ?? '',
  open: true,
  cooldownSec: existing?.cooldownSec ?? 180,
  fireworksAt: existing?.fireworksAt ?? 0,
});
const adminUid = await ensureAdmin('admin@example.com', 'admin1234');
console.log(`Admin: admin@example.com / admin1234 (uid ${adminUid})`);

const batch = arg('kratongs', 0);
if (batch) {
  const data = {};
  for (let i = 0; i < batch; i++) data[`seed-${Date.now()}-${i}`] = demoKratong(i);
  await db('PATCH', 'kratongs', data);
  console.log(`Added ${batch} demo krathongs`);
}

const live = arg('live', 0);
if (live) {
  const over = arg('over', 60) * 1000;
  console.log(`Launching ${live} krathongs over ${over / 1000}s...`);
  const started = Date.now();
  await Promise.all(
    Array.from({ length: live }, (_, i) =>
      new Promise((r) => setTimeout(r, Math.random() * over)).then(() =>
        db('PUT', `kratongs/live-${started}-${i}`, { ...demoKratong(i), createdAt: Date.now() }),
      ),
    ),
  );
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
