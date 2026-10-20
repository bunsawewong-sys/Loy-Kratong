import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, remove, serverTimestamp, set, update } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const parts = { base: 0, flower: 1, candle: 2, color: 3 };

function kratong(uid: string, extra: Record<string, unknown> = {}) {
  return { uid, name: 'กอล์ฟ', wish: 'ขอให้มีความสุข', parts, createdAt: serverTimestamp(), ...extra };
}

function launch(uid: string, id: string, extra: Record<string, unknown> = {}) {
  const db = env.authenticatedContext(uid).database();
  return update(ref(db), {
    [`kratongs/${id}`]: kratong(uid, extra),
    [`users/${uid}/lastLaunchAt`]: serverTimestamp(),
  });
}

async function seed(data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await update(ref(ctx.database()), data);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-loy-kratong',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearDatabase();
  await seed({ config: { open: true, cooldownSec: 60, eventName: 'Test', logo: '', fireworksAt: 0 }, 'admins/admin': true });
});

describe('launching a krathong', () => {
  it('works for a signed-in player when the event is open', async () => {
    await assertSucceeds(launch('alice', 'k1'));
  });

  it('is rejected for anonymous visitors without auth', async () => {
    const db = env.unauthenticatedContext().database();
    await assertFails(set(ref(db, 'kratongs/k1'), kratong('nobody')));
  });

  it('is rejected without updating lastLaunchAt in the same write', async () => {
    const db = env.authenticatedContext('alice').database();
    await assertFails(set(ref(db, 'kratongs/k1'), kratong('alice')));
  });

  it('is rejected when the event is closed', async () => {
    await seed({ 'config/open': false });
    await assertFails(launch('alice', 'k1'));
  });

  it('enforces the cooldown', async () => {
    await assertSucceeds(launch('alice', 'k1'));
    await assertFails(launch('alice', 'k2'));
  });

  it('allows launching again once the cooldown has passed', async () => {
    await seed({ 'users/alice/lastLaunchAt': Date.now() - 61_000 });
    await assertSucceeds(launch('alice', 'k2'));
  });

  it('allows unlimited launches when cooldown is 0', async () => {
    await seed({ 'config/cooldownSec': 0 });
    await assertSucceeds(launch('alice', 'k1'));
    await assertSucceeds(launch('alice', 'k2'));
  });

  it('rejects impersonating another uid', async () => {
    const db = env.authenticatedContext('alice').database();
    await assertFails(
      update(ref(db), {
        'kratongs/k1': kratong('bob'),
        'users/alice/lastLaunchAt': serverTimestamp(),
      }),
    );
  });

  it('rejects over-long wishes, bad parts and extra fields', async () => {
    await assertFails(launch('alice', 'k1', { wish: 'x'.repeat(121) }));
    await assertFails(launch('alice', 'k2', { parts: { ...parts, base: 9 } }));
    await assertFails(launch('alice', 'k3', { hacked: true }));
    await assertFails(launch('alice', 'k4', { hidden: true }));
    await assertFails(launch('alice', 'k5', { name: '' }));
  });

  it('does not let players edit or delete existing krathongs', async () => {
    await assertSucceeds(launch('alice', 'k1'));
    const db = env.authenticatedContext('alice').database();
    await assertFails(set(ref(db, 'kratongs/k1/wish'), 'changed'));
    await assertFails(remove(ref(db, 'kratongs/k1')));
  });
});

describe('reactions', () => {
  beforeEach(() => launch('alice', 'k1'));

  it('lets a player react once to an existing krathong', async () => {
    const db = env.authenticatedContext('bob').database();
    await assertSucceeds(set(ref(db, 'reactions/k1/bob'), 'heart'));
    await assertFails(set(ref(db, 'reactions/k1/bob'), 'flower'));
  });

  it('rejects reactions for someone else, unknown types or missing krathongs', async () => {
    const db = env.authenticatedContext('bob').database();
    await assertFails(set(ref(db, 'reactions/k1/carol'), 'heart'));
    await assertFails(set(ref(db, 'reactions/k1/bob'), 'poop'));
    await assertFails(set(ref(db, 'reactions/missing/bob'), 'heart'));
  });
});

describe('admin', () => {
  beforeEach(() => launch('alice', 'k1'));

  it('can hide and delete krathongs; players cannot hide', async () => {
    const admin = env.authenticatedContext('admin').database();
    const player = env.authenticatedContext('bob').database();
    await assertFails(set(ref(player, 'kratongs/k1/hidden'), true));
    await assertSucceeds(set(ref(admin, 'kratongs/k1/hidden'), true));
    await assertSucceeds(remove(ref(admin, 'kratongs/k1')));
  });

  it('only admins change config', async () => {
    const admin = env.authenticatedContext('admin').database();
    const player = env.authenticatedContext('bob').database();
    await assertFails(set(ref(player, 'config/open'), false));
    await assertSucceeds(update(ref(admin, 'config'), { open: false, cooldownSec: 120 }));
    await assertFails(update(ref(admin, 'config'), { unknown: 1 }));
  });

  it('can reset all event data', async () => {
    const admin = env.authenticatedContext('admin').database();
    await assertSucceeds(update(ref(admin), { kratongs: null, reactions: null, users: null }));
    const player = env.authenticatedContext('bob').database();
    await assertFails(update(ref(player), { kratongs: null }));
  });

  it('players cannot make themselves admin', async () => {
    const db = env.authenticatedContext('bob').database();
    await assertFails(set(ref(db, 'admins/bob'), true));
  });
});
