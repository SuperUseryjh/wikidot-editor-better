import {
    DEFAULT_FONT_SIZE,
    EDITOR_CONFIG_KEY,
    FONT_SIZE_KEY,
    MAX_FONT_SIZE,
    MIN_FONT_SIZE,
} from './constants';

export interface EditorBetterConfig {
    editorOverrideEnabled: boolean;
    theme: 'system' | 'light' | 'dark';
    lineNumbers: boolean;
    minimap: boolean;
    renderLineHighlight: 'none' | 'line' | 'all' | 'gutter';
    wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
    tabSize: number;
    insertSpaces: boolean;
    folding: boolean;
    bracketPairColorization: boolean;
    suggest: boolean;
    stickyScroll: boolean;
    stickyScrollMaxLineCount: number;
    scrollBeyondLastLine: boolean;
}

export const DEFAULT_CONFIG: EditorBetterConfig = {
    editorOverrideEnabled: true,
    theme: 'system',
    lineNumbers: true,
    minimap: false,
    renderLineHighlight: 'line',
    wordWrap: 'off',
    tabSize: 4,
    insertSpaces: true,
    folding: true,
    bracketPairColorization: true,
    suggest: false,
    stickyScroll: true,
    stickyScrollMaxLineCount: 5,
    scrollBeyondLastLine: false,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const number = typeof value === 'number' && Number.isFinite(value) ? value : NaN;
    return Number.isNaN(number) ? fallback : Math.min(max, Math.max(min, Math.round(number)));
}

function pickString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function normalizeConfig(value: unknown): EditorBetterConfig {
    const config = (typeof value === 'object' && value !== null ? value : {}) as Partial<EditorBetterConfig>;
    return {
        editorOverrideEnabled: config.editorOverrideEnabled !== false,
        theme: pickString(config.theme, ['system', 'light', 'dark'] as const, 'system'),
        lineNumbers: config.lineNumbers !== false,
        minimap: config.minimap === true,
        renderLineHighlight: pickString(config.renderLineHighlight, ['none', 'line', 'all', 'gutter'] as const, 'line'),
        wordWrap: pickString(config.wordWrap, ['off', 'on', 'wordWrapColumn', 'bounded'] as const, 'off'),
        tabSize: [2, 4, 8].includes(config.tabSize as number) ? (config.tabSize as number) : 4,
        insertSpaces: config.insertSpaces !== false,
        folding: config.folding !== false,
        bracketPairColorization: config.bracketPairColorization !== false,
        suggest: config.suggest === true,
        stickyScroll: config.stickyScroll !== false,
        stickyScrollMaxLineCount: clampInt(config.stickyScrollMaxLineCount, 1, 10, 5),
        scrollBeyondLastLine: config.scrollBeyondLastLine === true,
    };
}

/**
 * 配置存储后端。油猴版本使用 GM API；同步到 Chrome 扩展时仅需把
 * configStorage 换成 chrome.storage.local 的实现，上层逻辑无需改动。
 */
export interface ConfigStorage {
    load(): Promise<unknown>;
    save(config: unknown): Promise<void>;
}

const gmConfigStorage: ConfigStorage = {
    async load() {
        return await window.GM_getValue?.(EDITOR_CONFIG_KEY, undefined);
    },
    async save(config) {
        await window.GM_setValue?.(EDITOR_CONFIG_KEY, config);
    },
};

export const configStorage: ConfigStorage = gmConfigStorage;

export async function loadConfig(): Promise<EditorBetterConfig> {
    return normalizeConfig(await configStorage.load());
}

export async function saveConfig(config: unknown): Promise<void> {
    await configStorage.save(config);
}

/** 字号沿用 localStorage：主世界与隔离世界共享同一份存储。 */
export function loadFontSize(): number {
    return clampInt(parseInt(localStorage.getItem(FONT_SIZE_KEY) || '', 10), MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE);
}

export function saveFontSize(size: number): number {
    const clamped = clampInt(size, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE);
    localStorage.setItem(FONT_SIZE_KEY, String(clamped));
    return clamped;
}
