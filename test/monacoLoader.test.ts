import { afterEach, describe, expect, test } from 'bun:test';

const originalWindow = (globalThis as any).window;

afterEach(() => {
    (globalThis as any).window = originalWindow;
});

describe('Monaco loader state', () => {
    test('reuses preloaded Monaco without replacing page AMD globals', async () => {
        const require = () => undefined;
        const define = () => undefined;
        const pageWindow = {
            require,
            define,
            monaco: {
                editor: { create: () => undefined },
                KeyCode: {},
                KeyMod: {},
                Selection: class {},
                languages: {},
            },
        };
        (globalThis as any).window = pageWindow;

        const loader = await import('../src/monacoLoader');
        expect(loader.monacoLoading()).toBeFalse();

        const monaco = await loader.loadMonaco();

        expect(monaco.editor).toBe(pageWindow.monaco.editor);
        expect(loader.monacoLoading()).toBeFalse();
        expect(loader.monacoReady()).toBeTrue();
        expect(pageWindow.require).toBe(require);
        expect(pageWindow.define).toBe(define);
    });
});
