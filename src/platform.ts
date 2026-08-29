/**
 * 平台能力适配层：把油猴（Tampermonkey）的 GM_* API 封装成统一接口。
 * 同步到 Chrome 扩展版本时，仅需替换本文件的实现（改用 chrome.runtime /
 * chrome.cookies / chrome.notifications / chrome.tabs 等），上层业务无需改动。
 */

export interface PlatformRequestOptions {
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
    data?: string;
    timeout?: number;
}

export interface PlatformRequestResult {
    ok: boolean;
    status: number;
    text: string;
    headers: string;
    finalUrl?: string;
    error?: 'network' | 'timeout';
}

export function platformRequest(options: PlatformRequestOptions): Promise<PlatformRequestResult> {
    const request = window.GM_xmlhttpRequest;
    if (!request) {
        return Promise.resolve({ ok: false, status: 0, text: '', headers: '', finalUrl: options.url });
    }

    return new Promise((resolve) => {
        request({
            method: options.method,
            url: options.url,
            headers: options.headers,
            data: options.data,
            timeout: options.timeout,
            onload: (response) => {
                resolve({
                    ok: response.status >= 200 && response.status < 400,
                    status: response.status,
                    text: response.responseText,
                    headers: response.responseHeaders || '',
                    finalUrl: response.finalUrl,
                });
            },
            onerror: (response) => {
                resolve({
                    ok: false,
                    status: response.status || 0,
                    text: '',
                    headers: response.responseHeaders || '',
                    finalUrl: response.finalUrl,
                    error: 'network',
                });
            },
            ontimeout: () => {
                resolve({ ok: false, status: 0, text: '', headers: '', finalUrl: options.url, error: 'timeout' });
            },
        });
    });
}

export function platformReadCookie(url: string, name: string): Promise<string | undefined> {
    const list = window.GM_cookie?.list;
    if (!list) {
        return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
        list({ url, name }, (cookies) => {
            resolve(cookies.find((cookie) => cookie.name === name)?.value);
        });
    });
}

export function platformRegisterMenuCommand(caption: string, handler: () => void): void {
    window.GM_registerMenuCommand?.(caption, handler);
}

export function platformNotify(title: string, text: string, onClick?: () => void): void {
    window.GM_notification?.({ title, text, timeout: 15000, onclick: onClick });
}

export function platformOpenInTab(url: string, background: boolean): void {
    window.GM_openInTab?.(url, background);
}

export function platformGetScriptVersion(): string | undefined {
    return window.GM_info?.script?.version;
}
