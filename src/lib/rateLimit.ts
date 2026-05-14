/**
 * Simple client-side rate limiter using a sliding window.
 * Not a security boundary (can be bypassed), but prevents accidental abuse
 * and adds friction against casual attackers.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check if an action is rate-limited.
 * @param key - Unique identifier for the action (e.g., 'ai-chat', 'admin-login')
 * @param maxAttempts - Maximum allowed attempts in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if the action is allowed, false if rate-limited
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxAttempts) {
    return false; // Rate limited
  }

  entry.timestamps.push(now);
  return true; // Allowed
}

/**
 * Get seconds until the rate limit resets for a key.
 */
export function getRateLimitResetSeconds(key: string, windowMs: number): number {
  const entry = store.get(key);
  if (!entry || entry.timestamps.length === 0) return 0;
  const oldestInWindow = Math.min(...entry.timestamps);
  const resetAt = oldestInWindow + windowMs;
  return Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
}
