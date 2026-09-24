/**
 * In-process sliding-window store used by the rate limiter by default.
 * Multi-process and multi-instance deployments should provide a shared store
 * implementing the same increment() contract.
 */
class MemoryRateLimitStore {
  constructor() {
    this.requests = new Map();
  }

  /**
   * Record a hit and return the number of hits still inside the window.
   * @param {string} key
   * @param {number} windowMs
   * @param {number} [now]
   * @returns {Promise<number>}
   */
  async increment(key, windowMs, now = Date.now()) {
    const validRequests = (this.requests.get(key) || []).filter(
      (time) => now - time < windowMs
    );
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return validRequests.length;
  }
}

module.exports = MemoryRateLimitStore;
