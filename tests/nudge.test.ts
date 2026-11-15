import { describe, expect, it } from 'vitest';
import { close, MIN_SITES, shouldShow, type Nudge } from '@/lib/nudge';

const DAY = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 10, 1);
const fresh: Nudge = { firstSeen: start };

describe('rate and share hint', () => {
  it('waits for a few days of use and enough sites', () => {
    expect(shouldShow(fresh, MIN_SITES, start + 2 * DAY)).toBe(false);
    expect(shouldShow(fresh, MIN_SITES - 1, start + 10 * DAY)).toBe(false);
    expect(shouldShow(fresh, MIN_SITES, start + 3 * DAY)).toBe(true);
  });

  it('comes back after being closed, twice, then stays away', () => {
    let now = start + 3 * DAY;
    let nudge = close(fresh, now);
    expect(shouldShow(nudge, 50, now + 13 * DAY)).toBe(false);
    now += 14 * DAY;
    expect(shouldShow(nudge, 50, now)).toBe(true);
    nudge = close(nudge, now);
    expect(shouldShow(nudge, 50, now + 59 * DAY)).toBe(false);
    now += 60 * DAY;
    expect(shouldShow(nudge, 50, now)).toBe(true);
    nudge = close(nudge, now);
    expect(shouldShow(nudge, 50, now + 1000 * DAY)).toBe(false);
  });

  it('stays away once someone rated or shared', () => {
    expect(shouldShow({ ...fresh, done: true }, 50, start + 100 * DAY)).toBe(false);
  });
});
