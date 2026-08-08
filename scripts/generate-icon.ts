import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ICON_SIZE = 128;

export function generatePngIconDataUrl(svgPath: string): string {
    const svg = readFileSync(svgPath, 'utf8');
    const png = new Resvg(svg, {
        fitTo: { mode: 'width', value: ICON_SIZE },
    }).render().asPng();

    return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

export function generateProjectPngIconDataUrl(root: string): string {
    return generatePngIconDataUrl(resolve(root, 'assets/logo.svg'));
}
