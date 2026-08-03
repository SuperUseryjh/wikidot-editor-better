import { MONACO_VERSION } from './constants';
import { log, logError } from './utils';

/**
 * Monaco 加载策略：
 * 首选：多个 AMD CDN 并行竞争，取最快者。实测 bootcdn/staticfile/fastly/jsdelivr
 * 在不同时刻各自成功过（可达性/速度互相波动），并行确保无论哪个快都能直接命中，
 * 不再单点等待超时。ESM 的 npmmirror 源因 files 服务对 .css 返回错误 MIME 而稳定失败，
 * 故不参与首选，ESM 仅作最后兜底。
 */

/** AMD 单文件 CDN（前 AMD_PRIMARY_COUNT 个进入首选并行竞争，其余按顺序兜底） */
const AMD_CDNS = [
    'https://cdn.bootcdn.net/ajax/libs/monaco-editor/0.52.2',
    'https://cdn.staticfile.net/monaco-editor/0.52.2',
    'https://fastly.jsdelivr.net/npm/monaco-editor@0.52.2',
    'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2',
    'https://unpkg.com/monaco-editor@0.52.2',
];

/** 首选并行竞争的 AMD CDN 数量（其余进入串行兜底） */
const AMD_PRIMARY_COUNT = 4;

/** ESM 兜底源 */
const ESM_CDNS = [
    'https://unpkg.com/monaco-editor@0.52.2',
    'https://fastly.jsdelivr.net/npm/monaco-editor@0.52.2',
    'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2',
];

const AMD_TIMEOUT = 20000; // editor.main 约 5MB，下载受 CDN 链路速度波动，需给足时间；并行下由最快者胜出
const ESM_TIMEOUT = 45000; // ESM 模块图加载超时

let monacoPromise: Promise<any> | null = null;
let lastMode: 'amd' | 'esm' | null = null;

/** 当前是否仍在尝试加载 Monaco（供外部提示用） */
export function monacoLoading(): boolean {
    return monacoPromise !== null;
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

/** 多个 Promise 竞争，任一成功即返回（全部失败则抛错） */
function firstSuccess<T>(promises: Promise<T>[], onFail: (e: unknown) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let pending = promises.length;
        const errors: unknown[] = [];
        for (const p of promises) {
            p.then(resolve, (e) => {
                errors.push(e);
                onFail(e);
                if (--pending === 0) {
                    reject(new Error(errors.map((x) => (x as Error).message).join(' | ')));
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
        (window as any).require = undefined;
    } catch { /* ignore */ }
    try {
        (window as any).define = undefined;
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

/** AMD 方式：fetch loader 源码 + 独立作用域执行，模块加载时序可控 */
async function tryLoadAmd(base: string): Promise<any> {
    const loaderUrl = `${base}/min/vs/loader.js`;

    // 若全局已是可用的 Monaco AMD require，直接用
    if (isMonacoRequire()) {
        lastMode = 'amd';
        return loadAmdModules(base);
    }

    // 获取 loader.js 源码
    let code: string;
    try {
        const resp = await fetch(loaderUrl);
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        code = await resp.text();
    } catch (e) {
        // fetch 失败（网络/CORS），退化为同步 script 注入
        log(`fetch loader.js 失败(${(e as Error).message})，改用 script 注入`);
        await injectScript(loaderUrl, true);
        if (!isMonacoRequire()) {
            throw new Error('script 注入后 require 仍不可用');
        }
        lastMode = 'amd';
        return loadAmdModules(base);
    }

    // 执行前强制清理全局 define/require（页面脚本可能已定义了"假 AMD"）
    const diag = forceCleanGlobals();
    log('清理全局 define/require →', diag);

    // 在独立函数作用域执行 loader.js（避免顶层 const 与全局冲突，可重复执行）
    try {
        // eslint-disable-next-line no-new-func
        new Function(code).call(window);
    } catch (e) {
        // new Function 被 CSP 禁止时退化为 script 注入
        logError('new Function 执行 loader.js 失败，改用 script 注入:', e);
        await injectScript(loaderUrl, true);
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

/** 加载 Monaco Editor（结果缓存），多路径竞争 + 兜底 */
export function loadMonaco(): Promise<any> {
    if (monacoPromise) {
        return monacoPromise;
    }
    monacoPromise = doLoadMonaco().catch((err) => {
        monacoPromise = null; // 允许下次重试
        throw err;
    });
    return monacoPromise;
}

async function doLoadMonaco(): Promise<any> {
    log('准备加载 Monaco…');

    // 若此前已成功初始化过 AMD loader，直接复用
    if (isMonacoRequire() && lastMode === 'amd') {
        return loadAmdModules(AMD_CDNS[0]);
    }

    // 首选：前 AMD_PRIMARY_COUNT 个 AMD CDN 并行竞争，取最快者。
    // 实测 bootcdn/staticfile/fastly/jsdelivr 可达性与速度互相波动，谁快不确定，
    // 并行确保直接命中，避免单点超时白等 + 串行兜底重复等待。
    const primary: Promise<any>[] = [];
    for (const base of AMD_CDNS.slice(0, AMD_PRIMARY_COUNT)) {
        primary.push(
            tryLoadAmd(base).then((m) => {
                log(`Monaco ${MONACO_VERSION} 加载成功（AMD: ${base}）`);
                return m;
            })
        );
    }
    try {
        return await firstSuccess(primary, (e) => log('[加载] 首选路径失败（预期兜底）:', e));
    } catch (e) {
        log('[加载] 首选路径全部失败，进入兜底:', e);
    }

    // 兜底：其余 AMD CDN（避免与首选重复）
    for (const base of AMD_CDNS.slice(AMD_PRIMARY_COUNT)) {
        try {
            const monaco = await tryLoadAmd(base);
            log(`Monaco ${MONACO_VERSION} 加载成功（AMD: ${base}）`);
            return monaco;
        } catch (e) {
            logError(`AMD 兜底失败（${base}）:`, e);
        }
    }

    // 兜底：其余 ESM CDN
    for (const base of ESM_CDNS) {
        try {
            const monaco = await tryLoadEsm(base);
            log(`Monaco ${MONACO_VERSION} 加载成功（ESM: ${base}）`);
            return monaco;
        } catch (e) {
            logError(`ESM 兜底失败（${base}）:`, e);
        }
    }

    throw new Error('Monaco 加载失败：所有 CDN/加载方式均不可用');
}
