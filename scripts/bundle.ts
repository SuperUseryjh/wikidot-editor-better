import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as esbuild from 'esbuild';

const root = resolve(import.meta.dir, '..');
const bootstrapResult = await esbuild.build({
    entryPoints: [resolve(root, 'dist/bootstrapMain.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
});
const bootstrapCode = bootstrapResult.outputFiles[0].text;
const bootstrapCodePath = resolve(root, 'dist/generated/bootstrapCode.js');
mkdirSync(dirname(bootstrapCodePath), { recursive: true });
writeFileSync(bootstrapCodePath, `export const BOOTSTRAP_CODE = ${JSON.stringify(bootstrapCode)};\n`);

await esbuild.build({
    entryPoints: [resolve(root, 'dist/main.js')],
    bundle: true,
    outfile: resolve(root, 'dist/bundle.js'),
    format: 'iife',
    platform: 'browser',
});
