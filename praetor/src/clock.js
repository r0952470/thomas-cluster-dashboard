// Injectable clock. All PRAETOR components take time from here, never from
// Date.now() directly, so longitudinal scenarios (14+ day retention, decay,
// correction-uptake latency) can be replayed in compressed wall-clock time —
// the same mechanism PRAETOR-Bench uses for its 30–90 day scenarios.

const DAY_MS = 24 * 60 * 60 * 1000;

class Clock {
  constructor(startMs = Date.now()) {
    this._now = startMs;
    this._frozen = false;
  }

  static frozen(startIso) {
    const c = new Clock(new Date(startIso).getTime());
    c._frozen = true;
    return c;
  }

  now() {
    return this._frozen ? this._now : Date.now();
  }

  nowIso() {
    return new Date(this.now()).toISOString();
  }

  advanceDays(days) {
    if (!this._frozen) throw new Error('advanceDays requires a frozen clock');
    this._now += days * DAY_MS;
  }

  daysBetween(fromMs, toMs = this.now()) {
    return (toMs - fromMs) / DAY_MS;
  }
}

module.exports = { Clock, DAY_MS };
