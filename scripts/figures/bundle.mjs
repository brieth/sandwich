// Shared by check.mjs and render.mjs: bundles an entry against either the
// whole registry or one group file, so a figure under construction can be
// checked while other files are mid-edit.
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../..');

/** Pulls --file <path> out of argv, returning the remaining args. */
export function takeFile(argv) {
  const i = argv.indexOf('--file');
  if (i < 0) return { file: null, rest: argv };
  const file = resolve(argv[i + 1]);
  return { file, rest: [...argv.slice(0, i), ...argv.slice(i + 2)] };
}

/**
 * Bundles entry with the import '__figs__' bound to { FIGS, CUES }: from one
 * group file when file is given, else from the registry.
 */
export async function bundle(entry, file, format, platform = 'browser') {
  const dir = mkdtempSync(join(tmpdir(), 'figs-'));
  const shim = join(dir, 'figs.ts');
  writeFileSync(
    shim,
    file
      ? `import { group } from ${JSON.stringify(file)};\nexport const FIGS = group.figures;\nexport const CUES = group.cues;\nexport const FIGURE_FOR = group.exercises;\n`
      : `export { FIGS, CUES, FIGURE_FOR } from ${JSON.stringify(join(root, 'src/lib/figures/index.ts'))};\n`,
  );
  const out = join(dir, format === 'esm' ? 'out.mjs' : 'out.js');
  await build({ entryPoints: [entry], bundle: true, format, platform, outfile: out, alias: { __figs__: shim }, logLevel: 'error' });
  return out;
}
