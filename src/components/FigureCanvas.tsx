import { useEffect, useRef } from 'react';
import { drawOps, paletteFrom } from '../lib/figure3d/draw';
import type { Prepared } from '../lib/figure3d/figure';
import { opsAt } from '../lib/figure3d/figure';
import { CYCLE, sweepAt } from '../lib/tempo';

/**
 * One angle on a figure, animated through the rep on a canvas.
 *
 * Redrawn every frame from the 3D pose, so the depth order is worked out
 * fresh each time: a forearm that passes behind the head halfway through goes
 * behind it then and not before. The clock starts when the canvas mounts, which
 * is when the tempo counter beside it starts too, since the modal keys both by
 * the angle. With reduced motion it draws the first frame, the stretch, and
 * stops.
 */
export function FigureCanvas({ prep, view }: { prep: Prepared; view: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(canvas);
    const pal = paletteFrom(
      ctx,
      css.getPropertyValue('--accent') || '#2dd4bf',
      css.getPropertyValue('--muted') || '#8a93a3',
      css.getPropertyValue('--surface') || '#181b22',
    );
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const k = (w * dpr) / prep.W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const phase = still ? 0 : (((now - start) / 1000) % CYCLE) / CYCLE;
      drawOps(ctx, opsAt(prep, view, sweepAt(phase)), pal, prep.W);
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [prep, view]);
  return (
    <canvas
      ref={ref}
      className="stretch-canvas"
      style={{ aspectRatio: `${prep.W} / ${prep.H}` }}
      role="img"
      aria-hidden="true"
    />
  );
}
