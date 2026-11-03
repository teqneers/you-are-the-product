/** What the replay content script recorded: the last 30 seconds of the pointer, as a session replay service sees it. */
export interface ReplayTrace {
  width: number;
  height: number;
  /** [ms ago, x, y, kind] with kind 0 = move, 1 = click. */
  points: [number, number, number, number][];
  keys: number;
  duration: number;
}

/**
 * Plays a trace on a canvas over a screenshot of the page: the pointer path grows in real time, clicks pulse.
 * Returns a function that stops the animation.
 */
export function playReplay(canvas: HTMLCanvasElement, trace: ReplayTrace, screenshot: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d')!;
  canvas.width = trace.width;
  canvas.height = trace.height;
  const points = [...trace.points].sort((a, b) => b[0] - a[0]);
  const start = points[0]?.[0] ?? 0;
  const t0 = performance.now();
  let frame = 0;
  const draw = () => {
    const elapsed = performance.now() - t0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (screenshot) ctx.drawImage(screenshot, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgb(0 0 0 / 0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shown = points.filter(([ago]) => start - ago <= elapsed);
    ctx.lineWidth = Math.max(2, canvas.width / 300);
    ctx.strokeStyle = '#ff4d5e';
    ctx.beginPath();
    shown.forEach(([, x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    for (const [ago, x, y, kind] of shown) {
      if (kind !== 1) continue;
      const age = elapsed - (start - ago);
      ctx.beginPath();
      ctx.arc(x, y, canvas.width / 80 + Math.min(age / 20, 20), 0, Math.PI * 2);
      ctx.strokeStyle = `rgb(255 255 255 / ${Math.max(0.3, 1 - age / 1000)})`;
      ctx.stroke();
      ctx.strokeStyle = '#ff4d5e';
    }
    const last = shown[shown.length - 1];
    if (last) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(last[1], last[2], canvas.width / 120 + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (shown.length < points.length) frame = requestAnimationFrame(draw);
  };
  draw();
  return () => cancelAnimationFrame(frame);
}
