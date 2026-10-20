import { describe, expect, it } from 'vitest';
import { Scheduler } from '../../src/river/scheduler';

describe('Scheduler', () => {
  it('shows existing krathongs in insertion order, then rotates by least recently shown', () => {
    const s = new Scheduler();
    ['a', 'b', 'c'].forEach((id) => s.add(id, false));
    expect(s.next()).toBe('a');
    expect(s.next()).toBe('b');
    s.release('a');
    expect(s.next()).toBe('c');
    s.release('b');
    s.release('c');
    expect(s.next()).toBe('a');
    expect(s.next()).toBe('b');
  });

  it('puts fresh krathongs first', () => {
    const s = new Scheduler();
    s.add('old1', false);
    s.add('old2', false);
    s.add('new', true);
    expect(s.pendingPriority).toBe(1);
    expect(s.next()).toBe('new');
    expect(s.next()).toBe('old1');
  });

  it('never returns a krathong that is already visible', () => {
    const s = new Scheduler();
    s.add('a', false);
    expect(s.next()).toBe('a');
    s.prioritize('a');
    expect(s.pendingPriority).toBe(0);
    expect(s.next()).toBeUndefined();
  });

  it('forgets removed krathongs, including queued ones', () => {
    const s = new Scheduler();
    s.add('a', true);
    s.remove('a');
    expect(s.next()).toBeUndefined();
    expect(s.size).toBe(0);
  });
});
