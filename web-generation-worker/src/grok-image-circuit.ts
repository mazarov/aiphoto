export type GrokImageCircuitOptions = {
  window: number;
  minN: number;
  errorRate: number;
  cooldownMs: number;
  now?: () => number;
};

const DEFAULTS: Omit<GrokImageCircuitOptions, "now"> = {
  window: 20,
  minN: 8,
  errorRate: 0.5,
  cooldownMs: 60_000,
};

export class GrokImageCircuit {
  private readonly outcomes: boolean[] = [];
  private openedAt = 0;
  private readonly opts: Required<GrokImageCircuitOptions>;

  constructor(opts: Partial<GrokImageCircuitOptions> = {}) {
    this.opts = {
      ...DEFAULTS,
      ...opts,
      now: opts.now || Date.now,
    };
  }

  record(ok: boolean): void {
    this.outcomes.push(ok);
    if (this.outcomes.length > this.opts.window) this.outcomes.shift();
    if (ok) {
      this.openedAt = 0;
      return;
    }
    if (this.shouldOpen()) this.openedAt = this.opts.now();
  }

  isOpen(): boolean {
    if (!this.openedAt) return false;
    if (this.opts.now() - this.openedAt >= this.opts.cooldownMs) {
      this.openedAt = 0;
      return false;
    }
    return true;
  }

  private shouldOpen(): boolean {
    if (this.outcomes.length < this.opts.minN) return false;
    const errors = this.outcomes.filter((ok) => !ok).length;
    return errors / this.outcomes.length >= this.opts.errorRate;
  }
}

export const grokImageCircuit = new GrokImageCircuit();
