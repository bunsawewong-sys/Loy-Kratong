import {
  type DataSnapshot,
  limitToLast,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  update,
  equalTo,
  type Query,
} from 'firebase/database';
import { db } from './firebase';
import { DEFAULT_CONFIG, type EventConfig, type Kratong, type KratongParts, type ReactionType } from './types';

export function subscribeConfig(cb: (c: EventConfig) => void): () => void {
  return onValue(ref(db, 'config'), (snap) => cb({ ...DEFAULT_CONFIG, ...(snap.val() ?? {}) }));
}

function toKratong(snap: DataSnapshot): Kratong {
  return { ...(snap.val() as Omit<Kratong, 'id'>), id: snap.key! };
}

export interface KratongHandlers {
  added: (k: Kratong, live: boolean) => void;
  changed: (k: Kratong) => void;
  removed: (id: string) => void;
  /** Fired once the initial batch has been delivered. */
  ready?: () => void;
}

/**
 * Streams krathongs. `live` is false for records that existed when the subscription started,
 * true for ones launched afterwards (so the screen can give them a splashy entrance).
 */
export function subscribeKratongs(h: KratongHandlers, q: Query = ref(db, 'kratongs')): () => void {
  let initialDone = false;
  const offAdded = onChildAdded(q, (snap) => h.added(toKratong(snap), initialDone));
  const offChanged = onChildChanged(q, (snap) => h.changed(toKratong(snap)));
  const offRemoved = onChildRemoved(q, (snap) => h.removed(snap.key!));
  // onValue for the same query fires after all initial child_added events.
  const offValue = onValue(
    q,
    () => {
      initialDone = true;
      h.ready?.();
    },
    { onlyOnce: true },
  );
  return () => {
    offAdded();
    offChanged();
    offRemoved();
    offValue();
  };
}

export function recentKratongsQuery(limit: number): Query {
  return query(ref(db, 'kratongs'), orderByChild('createdAt'), limitToLast(limit));
}

export function myKratongsQuery(uid: string): Query {
  return query(ref(db, 'kratongs'), orderByChild('uid'), equalTo(uid));
}

export type ReactionMap = Record<string, ReactionType>;

/**
 * Streams reactions per krathong. `onNew` fires for every reaction that arrives after the
 * initial load, so the screen can animate it.
 */
export function subscribeReactions(
  onCounts: (kratongId: string, byUser: ReactionMap) => void,
  onNew?: (kratongId: string, type: ReactionType) => void,
  onRemoved?: (kratongId: string) => void,
): () => void {
  const known = new Map<string, Set<string>>();
  let ready = false;
  const handle = (snap: DataSnapshot) => {
    const id = snap.key!;
    const byUser = (snap.val() ?? {}) as ReactionMap;
    const seen = known.get(id) ?? new Set<string>();
    const isFirstLoad = !known.has(id) && !ready;
    for (const [uid, type] of Object.entries(byUser)) {
      if (!seen.has(uid)) {
        seen.add(uid);
        if (!isFirstLoad) onNew?.(id, type);
      }
    }
    known.set(id, seen);
    onCounts(id, byUser);
  };
  const r = ref(db, 'reactions');
  const offs = [
    onChildAdded(r, handle),
    onChildChanged(r, handle),
    onChildRemoved(r, (snap) => {
      known.delete(snap.key!);
      onRemoved?.(snap.key!);
    }),
    onValue(r, () => (ready = true), { onlyOnce: true }),
  ];
  return () => offs.forEach((off) => off());
}

export async function launchKratong(
  uid: string,
  data: { name: string; dept: string; wish: string; parts: KratongParts },
): Promise<string> {
  const id = push(ref(db, 'kratongs')).key!;
  const record: Record<string, unknown> = {
    uid,
    name: data.name,
    wish: data.wish,
    parts: data.parts,
    createdAt: serverTimestamp(),
  };
  if (data.dept) record.dept = data.dept;
  // One atomic write: the security rules only accept the krathong together with a fresh
  // lastLaunchAt, which is how the cooldown is enforced on the server.
  await update(ref(db), {
    [`kratongs/${id}`]: record,
    [`users/${uid}/lastLaunchAt`]: serverTimestamp(),
  });
  return id;
}

export function sendReaction(kratongId: string, uid: string, type: ReactionType): Promise<void> {
  return set(ref(db, `reactions/${kratongId}/${uid}`), type);
}

export function subscribeLastLaunch(uid: string, cb: (at: number) => void): () => void {
  return onValue(ref(db, `users/${uid}/lastLaunchAt`), (snap) => cb(snap.val() ?? 0));
}
