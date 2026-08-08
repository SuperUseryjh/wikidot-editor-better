import { MONACO_VERSION } from './constants';
import { log, logError } from './utils';

type MonacoLoadStageListener = (stage: 'fallback') => void;
let monacoLoadStageListener: MonacoLoadStageListener | null = null;

export function setMonacoLoadStageListener(listener: MonacoLoadStageListener | null): void {
    monacoLoadStageListener = listener;
}

/**
 * Monaco 加载策略：
 * 并行探测多个 AMD CDN，随后仅初始化最快可用的单一路径，避免共享全局 AMD Loader 的配置竞争。
 */

/** AMD 单文件 CDN（前 AMD_PRIMARY_COUNT 个并行探测，其余按顺序兜底） */
const AMD_CDNS = [
    'https://cdn.bootcdn.net/ajax/libs/monaco-editor/0.52.2',
    'https://cdn.staticfile.net/monaco-editor/0.52.2',
    'https://fastly.jsdelivr.net/npm/monaco-editor@0.52.2',
    'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2',
    'https://unpkg.com/monaco-editor@0.52.2',
];

const AMD_PRIMARY_COUNT = 4;

/** ESM 兜底源 */
const ESM_CDNS = [
    'https://unpkg.com/monaco-editor@0.52.2',
    'https://fastly.jsdelivr.net/npm/monaco-editor@0.52.2',
    'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2',
];

const AMD_TIMEOUT = 20000; // editor.main 约 5MB，下载受 CDN 链路速度波动，需给足时间
const ESM_TIMEOUT = 45000; // ESM 模块图加载超时
const AMD_PROBE_TIMEOUT = 5000;

let monacoPromise: Promise<any> | null = null;
let lastMode: 'amd' | 'esm' | null = null;
let monacoFallbackActive = false;
let monacoLoadState: 'idle' | 'loading' | 'ready' = 'idle';

/** 当前是否仍在尝试加载 Monaco（供外部提示用） */
export function monacoLoading(): boolean {
    return monacoLoadState === 'loading';
}

export function monacoReady(): boolean {
    return monacoLoadState === 'ready';
}

export function monacoFallbackLoading(): boolean {
    return monacoFallbackActive;
}

/**
 * 判断 window.require 是否为 Monaco 的 AMD require。
 * Monaco 0.52 的全局 require 有 config/define（define 是 Monaco 特有标志），没有 toUrl。
 */
function isMonacoRequire(): boolean {
    return (
        typeof window.require === 'function' &&
        typeof (window.require as any).config === 'function' &&
        typeof (window.require as any).define === 'function'
    );
}

interface GlobalPropertySnapshot {
    name: 'require' | 'define' | 'AMDLoader';
    descriptor?: PropertyDescriptor;
}

function snapshotAmdGlobals(): GlobalPropertySnapshot[] {
    return ['require', 'define', 'AMDLoader'].map((name) => ({
        name: name as GlobalPropertySnapshot['name'],
        descriptor: Object.getOwnPropertyDescriptor(window, name),
    }));
}

function restoreAmdGlobals(snapshots: GlobalPropertySnapshot[]): void {
    for (const { name, descriptor } of snapshots) {
        try {
            if (descriptor) {
                Object.defineProperty(window, name, descriptor);
            } else {
                delete (window as any)[name];
            }
        } catch (error) {
            logError('恢复页面 AMD 全局变量失败:', name, error);
        }
    }
}

/**
 * 统一 Monaco 的 API 形态：AMD 版的 KeyCode/KeyMod/Selection 在顶层，
 * ESM 版也在顶层（editor.api.js 顶层导出）。这里合并成一个扁平对象。
 */
function normalizeMonaco(api: any): any {
    const ns = api.editor || api;
    const merged: any = Object.assign({}, ns);
    merged.editor = ns;
    merged.KeyCode = merged.KeyCode ?? ns.KeyCode ?? api.KeyCode;
    merged.KeyMod = merged.KeyMod ?? ns.KeyMod ?? api.KeyMod;
    merged.Selection = merged.Selection ?? ns.Selection ?? api.Selection;
    merged.MarkerSeverity = merged.MarkerSeverity ?? ns.MarkerSeverity ?? api.MarkerSeverity;
    merged.languages = merged.languages ?? ns.languages ?? api.languages;
    return merged;
}

/** 注入一个 script 标签并等待加载完成 */
function injectScript(src: string, sync: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = !sync;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`加载 ${src} 失败`));
        const head = document.head || document.documentElement;
        head.appendChild(script);
    });
}

/** 带超时的 Promise 包装 */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(`${what} 超时（${ms / 1000}s）`)), ms);
        p.then(
            (v) => { window.clearTimeout(timer); resolve(v); },
            (e) => { window.clearTimeout(timer); reject(e); }
        );
    });
}

async function probeAmdCdn(base: string): Promise<{ base: string; code: string }> {
    const loaderUrl = `${base}/min/vs/loader.js`;
    const resp = await withTimeout(fetch(loaderUrl), AMD_PROBE_TIMEOUT, `探测 ${loaderUrl}`);
    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
    }
    return { base, code: await resp.text() };
}

function firstSuccess<T>(promises: Promise<T>[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let pending = promises.length;
        const errors: unknown[] = [];
        for (const promise of promises) {
            promise.then(resolve, (error) => {
                errors.push(error);
                if (--pending === 0) {
                    reject(new Error(errors.map((item) => (item as Error).message).join(' | ')));
                }
            });
        }
    });
}

/**
 * 强制清理全局 define/require。
 * var/函数声明创建的全局属性 configurable=false，delete 在严格模式会失败，
 * 但 Object.defineProperty 重定义 + 赋值可以成功。返回诊断信息。
 */
function forceCleanGlobals(): string {
    const info: string[] = [];
    const snap = (name: string) => {
        try {
            const d = Object.getOwnPropertyDescriptor(window, name);
            info.push(`${name}: type=${typeof (window as any)[name]}${d ? ` writable=${d.writable} configurable=${d.configurable}` : ''}`);
        } catch {
            info.push(`${name}: 描述符获取失败`);
        }
    };
    snap('require');
    snap('define');
    try {
        Object.defineProperty(window, 'require', { writable: true, configurable: true });
    } catch { /* ignore */ }
    try {
        Object.defineProperty(window, 'define', { writable: true, configurable: true });
    } catch { /* ignore */ }
    try {
        Object.defineProperty(window, 'AMDLoader', { writable: true, configurable: true });
    } catch { /* ignore */ }
    try {
        (window as any).require = undefined;
    } catch { /* ignore */ }
    try {
        (window as any).define = undefined;
    } catch { /* ignore */ }
    try {
        (window as any).AMDLoader = undefined;
    } catch { /* ignore */ }
    return info.join('; ');
}

/** ESM 方式：原生动态 import，语言级加载，不依赖全局 define */
async function tryLoadEsm(base: string): Promise<any> {
    const entryUrl = `${base}/esm/vs/editor/editor.api.js`;
    const workerMain = `${base}/esm/vs/base/worker/workerMain.js`;

    // ESM 版 Monaco 通过 getWorker 提供 module worker
    const workerMainUrl = workerMain; // 保持变量引用，避免 esbuild 静态解析
    window.MonacoEnvironment = {
        getWorker: function (_moduleId: string, label: string): Worker {
            const code = `import '${workerMainUrl}';`;
            return new Worker(
                `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`,
                { type: 'module', name: label }
            );
        },
    };

    // 用变量间接引用，避免 esbuild 尝试静态解析 import()
    const entry = entryUrl;
    const mod: any = await withTimeout(
        import(/* webpackIgnore: true */ entry),
        ESM_TIMEOUT,
        'ESM 模块图加载'
    );
    window.monaco = mod;
    lastMode = 'esm';
    return normalizeMonaco(mod);
}

/** AMD 方式：在已探测到 loader 源码后执行单路初始化 */
async function loadAmdInTemporaryGlobals(base: string, loaderCode?: string): Promise<any> {
    const loaderUrl = `${base}/min/vs/loader.js`;

    let code = loaderCode;
    if (!code) {
        // fetch 失败（网络/CORS），退化为同步 script 注入
        await injectScript(loaderUrl, true);
        if (!isMonacoRequire()) {
            throw new Error('script 注入后 require 仍不可用');
        }
        lastMode = 'amd';
        return loadAmdModules(base);
    } else {
        // 执行前强制清理全局 define/require（页面脚本可能已定义了"假 AMD"）
        // 在独立函数作用域执行 loader.js（避免顶层 const 与全局冲突，可重复执行）
        try {
            // eslint-disable-next-line no-new-func
            new Function(code).call(window);
        } catch (e) {
            // new Function 被 CSP 禁止时退化为 script 注入
            logError('new Function 执行 loader.js 失败，改用 script 注入:', e);
            await injectScript(loaderUrl, true);
        }
    }

    if (!isMonacoRequire()) {
        // 尝试手动触发 loader 初始化
        const AL: any = (window as any).AMDLoader;
        if (AL && typeof AL.init === 'function') {
            try {
                AL.init();
            } catch (e) {
                logError('AMDLoader.init 失败:', e);
            }
        }
    }
    if (!isMonacoRequire()) {
        throw new Error(`require 仍不可用（${loaderUrl}）`);
    }
    lastMode = 'amd';
    return loadAmdModules(base);
}

async function tryLoadAmd(base: string, loaderCode?: string): Promise<any> {
    const snapshots = snapshotAmdGlobals();
    forceCleanGlobals();
    try {
        return await loadAmdInTemporaryGlobals(base, loaderCode);
    } finally {
        restoreAmdGlobals(snapshots);
    }
}

/** 用当前全局 AMD require 加载 Monaco 编辑器主体 */
function loadAmdModules(base: string): Promise<any> {
    const req: any = window.require;
    const vsBase = `${base}/min/vs`;
    req.config({
        paths: { vs: vsBase },
        'vs/nls': { availableLanguages: { '*': 'zh-cn' } },
    });

    // 通过 data: URL 创建 worker，规避页面 CSP 对 blob: worker 的限制；
    // 用 getWorker 以便捕获 worker 加载失败（失败会导致 Monaco 回退主线程 tokenize 卡顿）
    const workerCode = [
        `self.MonacoEnvironment={baseUrl:'${vsBase}/'};`,
        `importScripts('${vsBase}/base/worker/workerMain.js');`,
    ].join('');
    const workerUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(workerCode)}`;
    window.MonacoEnvironment = {
        getWorker: function (_moduleId: string, label: string): Worker {
            try {
                const worker = new Worker(workerUrl, { name: label });
                worker.addEventListener('error', (e) => {
                    logError('Monaco worker 加载失败（可能导致主线程卡顿）:', (e as ErrorEvent).message || e);
                });
                return worker;
            } catch (e) {
                logError('创建 Monaco worker 失败:', e);
                throw e;
            }
        },
    };

    return withTimeout(
        new Promise<any>((resolve, reject) => {
            req(['vs/editor/editor.main'], function (monaco: any) {
                window.monaco = monaco;
                resolve(normalizeMonaco(monaco));
            }, function (err: any) {
                reject(err);
            });
        }),
        AMD_TIMEOUT,
        'editor.main 加载'
    );
}

/** 加载 Monaco Editor（结果缓存），多路径兜底 */
export function loadMonaco(): Promise<any> {
    if (monacoPromise) {
        return monacoPromise;
    }
    monacoLoadState = 'loading';
    monacoPromise = doLoadMonaco().then((monaco) => {
        monacoLoadState = 'ready';
        return monaco;
    }).catch((err) => {
        monacoPromise = null; // 允许下次重试
        monacoLoadState = 'idle';
        monacoFallbackActive = false;
        throw err;
    });
    return monacoPromise;
}

async function doLoadMonaco(): Promise<any> {
    log('准备加载 Monaco…');

    // 若此前已成功初始化过 AMD loader，直接复用
    if (window.monaco?.editor) {
        return normalizeMonaco(window.monaco);
    }
    const primary = AMD_CDNS.slice(0, AMD_PRIMARY_COUNT);
    try {
        const winner = await firstSuccess(primary.map(probeAmdCdn));
        const monaco = await tryLoadAmd(winner.base, winner.code);
        log(`Monaco ${MONACO_VERSION} 加载成功（AMD: ${winner.base}）`);
        return monaco;
    } catch (e) {
        logError('AMD 并行探测或首选初始化失败，进入串行兜底:', e);
        monacoFallbackActive = true;
        monacoLoadStageListener?.('fallback');
    }

    for (const base of AMD_CDNS) {
        try {
            const monaco = await tryLoadAmd(base);
            monacoFallbackActive = false;
            log(`Monaco ${MONACO_VERSION} 加载成功（AMD: ${base}）`);
            return monaco;
        } catch (e) {
            logError(`AMD 加载失败（${base}）:`, e);
        }
    }

    // 兜底：其余 ESM CDN
    for (const base of ESM_CDNS) {
        try {
            const monaco = await tryLoadEsm(base);
            monacoFallbackActive = false;
            log(`Monaco ${MONACO_VERSION} 加载成功（ESM: ${base}）`);
            return monaco;
        } catch (e) {
            logError(`ESM 兜底失败（${base}）:`, e);
        }
    }

    throw new Error('Monaco 加载失败：所有 CDN/加载方式均不可用');
}
