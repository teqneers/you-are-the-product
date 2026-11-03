import { browser } from 'wxt/browser';
import type { ReplayTrace } from '@/lib/replay';

// Records mouse movements, clicks and scrolling of the last 30 seconds, only in memory, so the live view can
// replay them the way a session replay service (Hotjar, Clarity, …) sees them. Keys are only counted, never read.
const KEEP_MS = 30_000;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    const points: [number, number, number, number][] = [];
    const keyTimes: number[] = [];
    let lastMove = 0;
    const add = (x: number, y: number, kind: number) => {
      const now = Date.now();
      points.push([now, Math.round(x), Math.round(y), kind]);
      while (points.length && now - points[0]![0] > KEEP_MS) points.shift();
      if (points.length > 3000) points.shift();
    };
    addEventListener(
      'pointermove',
      (e) => {
        if (e.timeStamp - lastMove < 40) return;
        lastMove = e.timeStamp;
        add(e.clientX, e.clientY, 0);
      },
      { capture: true, passive: true },
    );
    addEventListener('pointerdown', (e) => add(e.clientX, e.clientY, 1), { capture: true, passive: true });
    addEventListener(
      'keydown',
      () => {
        const now = Date.now();
        keyTimes.push(now);
        while (keyTimes.length && now - keyTimes[0]! > KEEP_MS) keyTimes.shift();
      },
      { capture: true, passive: true },
    );

    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type !== 'replay-trace') return;
      const now = Date.now();
      const recent = points.filter((p) => now - p[0] <= KEEP_MS);
      const trace: ReplayTrace = {
        width: innerWidth,
        height: innerHeight,
        points: recent.map(([t, x, y, kind]) => [now - t, x, y, kind]),
        keys: keyTimes.filter((t) => now - t <= KEEP_MS).length,
        duration: recent.length ? now - recent[0]![0] : 0,
      };
      return Promise.resolve(trace);
    });
  },
});
