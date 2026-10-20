/**
 * Decides which krathong floats onto the river next.
 *
 * The river shows only a limited number of krathongs at once. Newly launched ones (and ones
 * that just received a reaction) jump the queue; otherwise the krathong that has waited the
 * longest since it was last on screen goes next, so everyone gets their turn in rotation.
 */
export class Scheduler {
  private lastShown = new Map<string, number>();
  private priority: string[] = [];
  private visible = new Set<string>();
  private tick = 0;

  /** Registers a krathong. `fresh` ones are shown before everything else. */
  add(id: string, fresh: boolean): void {
    if (!this.lastShown.has(id)) this.lastShown.set(id, fresh ? Infinity : -1);
    if (fresh) this.prioritize(id);
  }

  remove(id: string): void {
    this.lastShown.delete(id);
    this.visible.delete(id);
    this.priority = this.priority.filter((p) => p !== id);
  }

  has(id: string): boolean {
    return this.lastShown.has(id);
  }

  /** Puts a known krathong at the back of the priority queue unless it is already on screen. */
  prioritize(id: string): void {
    if (!this.lastShown.has(id) || this.visible.has(id) || this.priority.includes(id)) return;
    this.priority.push(id);
  }

  get size(): number {
    return this.lastShown.size;
  }

  get visibleCount(): number {
    return this.visible.size;
  }

  get pendingPriority(): number {
    return this.priority.length;
  }

  isVisible(id: string): boolean {
    return this.visible.has(id);
  }

  /** Picks the next krathong to put on screen and marks it visible. */
  next(): string | undefined {
    let id = this.priority.shift();
    if (id === undefined) {
      let best = Infinity;
      for (const [candidate, shown] of this.lastShown) {
        if (this.visible.has(candidate)) continue;
        if (shown < best) {
          best = shown;
          id = candidate;
        }
      }
    }
    if (id !== undefined) this.visible.add(id);
    return id;
  }

  /** Called when a krathong drifts off screen. */
  release(id: string): void {
    if (!this.visible.delete(id)) return;
    if (this.lastShown.has(id)) this.lastShown.set(id, ++this.tick);
  }
}
