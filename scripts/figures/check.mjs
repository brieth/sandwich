// Geometry and biomechanics checks on figures.
//
//   node scripts/figures/check.mjs [key,key,...|all] [--file src/lib/figures/<group>.ts]
//
// Prints muscle lengths, leverage and joint angles at t = 0, 0.25, 0.5, 0.75
// and 1 (0 is the stretch), then PASS or one FAIL line per problem. Exits 1 if
// any figure fails. --file checks one group file on its own.
import { join } from 'node:path';
import { bundle, here, takeFile } from './bundle.mjs';

const { file, rest } = takeFile(process.argv.slice(2));
const out = await bundle(join(here, 'check-entry.ts'), file, 'esm', 'node');
const mod = await import(out);
const arg = rest[0] ?? 'all';
const keys = arg === 'all' ? Object.keys(mod.FIGS) : arg.split(',');
const { text, failed } = mod.run(keys);
console.log(text);
process.exit(failed ? 1 : 0);
