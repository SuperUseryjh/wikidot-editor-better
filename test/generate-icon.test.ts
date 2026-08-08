import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { generatePngIconDataUrl } from '../scripts/generate-icon';

describe('generatePngIconDataUrl', () => {
    test('rasterizes the project SVG logo as a PNG data URL', () => {
        const icon = generatePngIconDataUrl(resolve(import.meta.dir, '../assets/logo.svg'));

        expect(icon).toStartWith('data:image/png;base64,');
        const png = Buffer.from(icon.slice('data:image/png;base64,'.length), 'base64');
        expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBeTrue();
    }, 15_000);
});
