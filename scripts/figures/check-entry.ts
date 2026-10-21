// @ts-expect-error bound by bundle.mjs
import { FIGS } from '__figs__';
import type { FigureDef } from '../../src/lib/figure3d/figure';
import { analyze } from '../../src/lib/figure3d/analysis';
import { prepare } from '../../src/lib/figure3d/figure';

export function run(keys: string[]): { text: string; failed: number } {
  let text = '';
  let failed = 0;
  const pct = (v: number) => (Number.isNaN(v) ? '  -' : `${Math.round(v * 100)}`.padStart(3));
  for (const key of keys) {
    const def = (FIGS as Record<string, FigureDef>)[key];
    if (!def) {
      text += `\n${key}: no such figure\n`;
      failed++;
      continue;
    }
    const prep = prepare(def);
    const r = analyze(def);
    text += `\n=== ${key}  box ${prep.W}x${prep.H}  scale ${prep.scale.toFixed(3)}  views ${def.views.map((v) => v.label).join(',')}\n`;
    text += `moving: ${[...prep.moving].sort().join(' ')}\n`;
    text += `t:                 ${r.ts.map((t) => String(t).padStart(6)).join('')}\n`;
    for (const m of r.muscles)
      text += `muscle ${m.name.padEnd(18)}${m.lengths.map((v) => v.toFixed(1).padStart(6)).join('')}   longest at t=${m.maxAt}, ${(m.drop * 100).toFixed(1)}% shorter at finish\n`;
    for (const l of r.lever) {
      text += `lever  ${l.name.padEnd(18)}${l.share.map((v) => pct(v).padStart(6)).join('')}   share of full leverage, %\n`;
      text += `       ${'sine arm/cable'.padEnd(18)}${l.sine.map((v) => pct(v).padStart(6)).join('')}\n`;
      text += `       ${'resists (+1)'.padEnd(18)}${l.sign.map((v) => String(v).padStart(6)).join('')}\n`;
    }
    for (const [k, v] of Object.entries(r.angles)) text += `angle  ${k.padEnd(18)}${v.map((x) => String(x).padStart(6)).join('')}\n`;
    // One line per distinct problem, with the moments it shows up at.
    const byWhat = new Map<string, number[]>();
    for (const i of r.issues) {
      const k = i.what.replace(/by [\d.]+|off by [-\d.]+|[\d.]+%|flexed \d+|extended \d+|abducted \d+|adducted \d+|elevated \d+|misses its target by [\d.]+/g, (s) => s.replace(/[\d.-]+/g, '#'));
      const arr = byWhat.get(k) ?? [];
      arr.push(i.t);
      byWhat.set(k, arr);
    }
    if (byWhat.size === 0) text += 'PASS\n';
    else {
      failed++;
      for (const [k, tsOf] of byWhat) {
        const ex = r.issues.find((i) => i.what.replace(/[\d.-]+/g, '#') === k.replace(/[\d.-]+/g, '#'))?.what ?? k;
        text += `FAIL ${ex}  (t=${tsOf.slice(0, 6).join(',')}${tsOf.length > 6 ? ',...' : ''})\n`;
      }
    }
  }
  return { text, failed };
}
export { FIGS };
