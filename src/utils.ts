/**
 * 通用工具函数
 */

/** 等待某个元素出现（轮询 + 兼容动态注入的场景） */
export function waitForElement(
    selector: string,
    root: ParentNode = document,
    timeout = 60000
): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
        const existing = root.querySelector<HTMLElement>(selector);
        if (existing) {
            resolve(existing);
            return;
        }
        const observer = new MutationObserver(() => {
            const el = root.querySelector<HTMLElement>(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        window.setTimeout(() => {
            observer.disconnect();
            reject(new Error(`waitForElement 超时: ${selector}`));
        }, timeout);
    });
}

/** 简单的日志，统一前缀便于过滤 */
export function log(...args: unknown[]): void {
    console.log('[Wikidot Editor Better]', ...args);
}

export function logError(...args: unknown[]): void {
    console.error('[Wikidot Editor Better]', ...args);
}
