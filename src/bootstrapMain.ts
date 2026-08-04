import { loadMonaco, monacoFallbackLoading, monacoLoading, setMonacoLoadStageListener } from './monacoLoader';
import { clearMonacoError, setupEditor, rollbackIfNeeded, showMonacoError } from './editor';
import { EDIT_TEXTAREA_ID, MONACO_RETRY_DELAYS } from './constants';
import { log, logError } from './utils';

/**
 * 主世界引导脚本（bootstrap）。
 * 由 src/main.ts 以 <script> 形式注入页面主世界执行，从而绕开 Tampermonkey
 * 隔离世界对 Monaco AMD 模块加载（DOM script + 全局 define）与动态 import 的限制。
 *
 * 注意：本文件会被单独打包为自包含 IIFE，不要依赖任何注入器侧的全局状态。
 */
(async function () {
    'use strict';

    if ((window as any).__webWikidotMonacoBootstrapped) {
        return; // 防止重复注入执行
    }
    (window as any).__webWikidotMonacoBootstrapped = true;

    // 预热加载 Monaco：尽早开始下载
    void loadMonaco().catch((e: unknown) => {
        logError('Monaco 预热加载失败（编辑区出现时仍会重试）:', e);
    });

    // 看门狗：检测主线程阻塞。主线程卡死时本回调不会执行；
    // 一旦恢复，会打印阻塞时长，用于定位"操作后卡死"发生在哪一步。
    let lastTick = performance.now();
    window.setInterval(() => {
        const now = performance.now();
        const gap = now - lastTick;
        if (gap > 1000) {
            logError(`[诊断] 主线程阻塞 ${Math.round(gap)}ms（阻塞期间事件循环停止）`);
        }
        lastTick = now;
    }, 500);

    const handled = new WeakSet<HTMLTextAreaElement>();
    const initializing = new WeakSet<HTMLTextAreaElement>();
    const exhausted = new WeakSet<HTMLTextAreaElement>();
    const attempts = new WeakMap<HTMLTextAreaElement, number>();
    let loadingFallbackDismissed = false;

    const showLoadingFallback = (): void => {
        if (loadingFallbackDismissed) {
            return;
        }
        if (document.getElementById('wikidot-monaco-loading-fallback')) {
            return;
        }
        const overlay = document.createElement('div');
        overlay.id = 'wikidot-monaco-loading-fallback';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'wikidot-monaco-loading-title');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.45);font:14px/1.5 system-ui,sans-serif;';
        const panel = document.createElement('section');
        panel.style.cssText = 'width:min(400px,100%);box-sizing:border-box;padding:20px;border:1px solid #b9c7d8;border-radius:10px;background:#fff;color:#1e293b;box-shadow:0 16px 48px rgba(15,23,42,.28);';
        const title = document.createElement('h2');
        title.id = 'wikidot-monaco-loading-title';
        title.textContent = 'Monaco Editor 加载较慢';
        title.style.cssText = 'margin:0 0 10px;font-size:18px;';
        const message = document.createElement('p');
        message.textContent = '首选下载源未能及时完成，正在尝试备用源。原生编辑框仍可继续使用。';
        message.style.cssText = 'margin:0 0 16px;';
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '继续使用原生编辑框';
        close.style.cssText = 'padding:7px 12px;border:1px solid #94a3b8;border-radius:6px;background:#fff;color:#334155;cursor:pointer;';
        close.addEventListener('click', () => {
            loadingFallbackDismissed = true;
            overlay.remove();
        });
        panel.append(title, message, close);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    };

    setMonacoLoadStageListener(() => {
        showLoadingFallback();
    });

    const retryManually = (textarea: HTMLTextAreaElement): void => {
        exhausted.delete(textarea);
        attempts.delete(textarea);
        clearMonacoError(textarea);
        void trySetup(textarea);
    };

    const trySetup = async (textarea: HTMLTextAreaElement): Promise<void> => {
        if (handled.has(textarea) || initializing.has(textarea) || exhausted.has(textarea)) {
            return;
        }
        initializing.add(textarea);
        try {
            const monaco = await loadMonaco();
            await setupEditor(monaco, textarea);
            document.getElementById('wikidot-monaco-loading-fallback')?.remove();
            handled.add(textarea);
            attempts.delete(textarea);
            exhausted.delete(textarea);
            clearMonacoError(textarea);
        } catch (e) {
            logError('初始化 Monaco 编辑器失败，已回退到原生编辑框:', e);
            rollbackIfNeeded();
            const attempt = attempts.get(textarea) || 0;
            attempts.set(textarea, attempt + 1);
            const delay = MONACO_RETRY_DELAYS[attempt];
            if (delay === undefined) {
                exhausted.add(textarea);
                showMonacoError(textarea, () => retryManually(textarea));
                return;
            }
            window.setTimeout(() => {
                if (
                    textarea.isConnected &&
                    document.getElementById(EDIT_TEXTAREA_ID) === textarea &&
                    !handled.has(textarea)
                ) {
                    void trySetup(textarea);
                }
            }, delay);
        } finally {
            initializing.delete(textarea);
        }
    };

    const check = (): void => {
        const ta = document.getElementById(EDIT_TEXTAREA_ID) as HTMLTextAreaElement | null;
        if (ta && !handled.has(ta) && !exhausted.has(ta)) {
            if (monacoFallbackLoading()) {
                showLoadingFallback();
            }
            void trySetup(ta);
        }
    };

    // 直接访问 edit:true 页面时，textarea 可能已渲染完成
    check();

    // wikidot 的编辑表单通常由 AJAX 注入，持续监听并支持再次编辑。
    // 节流：Monaco 接管后 DOM 变化频繁，避免每次变化都执行 check()
    let lastCheck = 0;
    const observer = new MutationObserver(() => {
        const now = Date.now();
        if (now - lastCheck < 500) {
            return;
        }
        lastCheck = now;
        check();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 若干秒后仍未接管编辑区，给出引导提示（避免误以为是脚本失效）
    window.setTimeout(() => {
        if (monacoLoading()) {
            log('Monaco 仍在加载中（CDN 下载/模块图较大），请稍候片刻…');
            return;
        }
        const isEditPage =
            /edit[:/]?true/i.test(window.location.href) ||
            /\/edit(\/|:)/i.test(window.location.pathname);
        log(
            `当前为${isEditPage ? '编辑页' : '查看页'}，尚未接管编辑区域。`,
            '请点击页面上的“编辑”按钮，或直接访问',
            `${window.location.origin}/edit:true/page:页面名`,
            '打开编辑页后脚本会自动接管。'
        );
    }, 8000);

    log('已启动（主世界），等待编辑区域出现…');
})();
