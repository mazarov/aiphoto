export type CircuitState = "closed" | "open" | "half_open";

export type CircuitBreaker = {
  allow(now?: number): boolean;
  success(now?: number): void;
  failure(now?: number): void;
  state(now?: number): CircuitState;
};

export function createCircuitBreaker(options: {
  failureThreshold: number;
  windowMs: number;
  openMs: number;
}): CircuitBreaker {
  let openedAt = 0;
  let halfOpenProbe = false;
  const failures: number[] = [];

  function prune(now: number) {
    while (failures.length > 0 && now - failures[0] > options.windowMs) {
      failures.shift();
    }
  }

  function currentState(now: number): CircuitState {
    if (openedAt === 0) return "closed";
    if (now - openedAt < options.openMs) return "open";
    return "half_open";
  }

  return {
    allow(now = Date.now()) {
      const state = currentState(now);
      if (state === "open") return false;
      if (state === "half_open") {
        if (halfOpenProbe) return false;
        halfOpenProbe = true;
        return true;
      }
      return true;
    },
    success(now = Date.now()) {
      openedAt = 0;
      halfOpenProbe = false;
      failures.length = 0;
      void now;
    },
    failure(now = Date.now()) {
      prune(now);
      failures.push(now);
      halfOpenProbe = false;
      if (currentState(now) === "half_open" || failures.length >= options.failureThreshold) {
        openedAt = now;
      }
    },
    state(now = Date.now()) {
      return currentState(now);
    },
  };
}
