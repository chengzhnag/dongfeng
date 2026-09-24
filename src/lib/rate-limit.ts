export class RateLimiter {
  private readonly entries = new Map<string, number[]>();
  private lastCleanup = 0;

  isLimited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    if (now - this.lastCleanup > 60 * 1000) {
      for (const [storedKey, timestamps] of this.entries) {
        if (timestamps.every(timestamp => now - timestamp >= windowMs)) this.entries.delete(storedKey);
      }
      this.lastCleanup = now;
    }

    if (this.entries.size > 10000) return true;

    const recent = (this.entries.get(key) || []).filter(timestamp => now - timestamp < windowMs);
    if (recent.length >= max) return true;
    recent.push(now);
    this.entries.set(key, recent);
    return false;
  }
}
