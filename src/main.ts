import { BOOTSTRAP_CODE } from './generated/bootstrapCode';
import { checkUpdate } from './checkUpdate';
import { EDITOR_CONFIG_KEY } from './constants';

interface EditorBetterConfig {
    editorOverrideEnabled: boolean;
}

const DEFAULT_CONFIG: EditorBetterConfig = {
    editorOverrideEnabled: true,
};

const INCLUDE_REQUEST_EVENT = 'wikidot-editor-better-include-request';
const INCLUDE_RESPONSE_EVENT = 'wikidot-editor-better-include-response';
const MAX_INCLUDE_RESPONSE_LENGTH = 1_500_000;
const WIKIDOT_TOKEN_PATTERN = /(?:^|[\r\n])set-cookie:\s*[^\r\n]*?wikidot_token7=([a-f0-9]+)/i;

interface IncludeBridgeRequest {
    id?: string;
    url?: string;
    method?: 'GET' | 'POST';
    data?: string;
}

function isAllowedIncludeUrl(value: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.wikidot\.com$/i.test(url.hostname)) {
            return false;
        }
        if (url.search || url.hash) {
            return false;
        }
        // 允许目标站首页（用于获取 wikidot_token7）、单层页面路径及 AMC 端点。
        return /^\/$|^\/(?:ajax-module-connector\.php|[^/][^?#]*)$/.test(url.pathname);
    } catch {
        return false;
    }
}

function installIncludeRequestBridge(): void {
    window.addEventListener(INCLUDE_REQUEST_EVENT, (event: Event) => {
        const detail = (event as CustomEvent<IncludeBridgeRequest>).detail;
        if (!detail?.id || !/^[a-z0-9-]+$/i.test(detail.id) || !detail.url || !isAllowedIncludeUrl(detail.url)) {
            console.error('[Wikidot Editor Better][include bridge] 请求被安全规则拒绝', { id: detail?.id, url: detail?.url, method: detail?.method });
            return;
        }
        const method = detail.method === 'POST' ? 'POST' : 'GET';
        if (method === 'POST' && (!detail.data || !/^moduleName=viewsource%2FViewSourceModule&page_id=\d+&wikidot_token7=[a-f0-9]+$/i.test(detail.data))) {
            console.error('[Wikidot Editor Better][include bridge] POST 请求体被安全规则拒绝', { id: detail.id, url: detail.url });
            return;
        }

        console.debug('[Wikidot Editor Better][include bridge] 发起 GM 请求', { id: detail.id, method, url: detail.url });
        const token = method === 'POST'
            ? /(?:^|&)wikidot_token7=([a-f0-9]+)$/i.exec(detail.data!)?.[1]
            : undefined;
        const respond = (ok: boolean, text = '', debug = '', headers = '', token?: string) => {
            const tokenFromHeader = token || WIKIDOT_TOKEN_PATTERN.exec(headers)?.[1];
            window.dispatchEvent(new CustomEvent(INCLUDE_RESPONSE_EVENT, {
                detail: { id: detail.id, ok, text: text.slice(0, MAX_INCLUDE_RESPONSE_LENGTH), debug, headers, token: tokenFromHeader },
            }));
        };
        if (!window.GM_xmlhttpRequest) {
            console.error('[Wikidot Editor Better][include bridge] GM_xmlhttpRequest 不可用');
            respond(false, '', 'GM_xmlhttpRequest 不可用');
            return;
        }
        window.GM_xmlhttpRequest({
            method,
            url: detail.url,
            headers: method === 'POST' ? {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                ...(token ? { Cookie: 'wikidot_token7=' + token } : {}),
            } : undefined,
            data: method === 'POST' ? detail.data : undefined,
            // GM 请求不保证跨域请求之间共享 cookie jar。ViewSourceModule 需要
            // 表单字段与 cookie 中的 wikidot_token7 一致，因此仅为已通过
            // 白名单校验的 AMC POST 显式携带这个短期 token。
            timeout: 10_000,
            onload: (response) => {
                const ok = response.status >= 200 && response.status < 400;
                const diagnostic = 'HTTP ' + response.status + '，响应 ' + response.responseText.length + ' 字符';
                const headerToken = WIKIDOT_TOKEN_PATTERN.exec(response.responseHeaders)?.[1];
                const finish = (cookieToken?: string) => {
                    console.log('[Wikidot Editor Better][include bridge] GM 请求完成', { id: detail.id, method, url: detail.url, ok, status: response.status, responseLength: response.responseText.length, tokenFoundInHeaders: Boolean(headerToken), tokenFoundInCookieStore: Boolean(cookieToken) });
                    respond(ok, response.responseText, diagnostic, response.responseHeaders, cookieToken || headerToken);
                };
                // Chromium 不会把 Set-Cookie 暴露给 responseHeaders。让 Tampermonkey
                // 从自己的 cookie 存储读取刚由此站写入的 token。
                if (method === 'GET' && !headerToken && window.GM_cookie) {
                    window.GM_cookie.list({ url: detail.url!, name: 'wikidot_token7' }, (cookies) => {
                        finish(cookies.find((cookie) => cookie.name === 'wikidot_token7')?.value);
                    });
                    return;
                }
                finish(headerToken);
            },
            onerror: (response) => {
                const diagnostic = '网络错误' + (response.status ? '（HTTP ' + response.status + '）' : '');
                console.error('[Wikidot Editor Better][include bridge] GM 请求网络错误', { id: detail.id, method, url: detail.url, status: response.status, statusText: response.statusText });
                respond(false, '', diagnostic);
            },
            ontimeout: () => {
                console.error('[Wikidot Editor Better][include bridge] GM 请求超时', { id: detail.id, method, url: detail.url });
                respond(false, '', 'GM 请求超时（10 秒）');
            },
        });
    });
}

function normalizeConfig(value: unknown): EditorBetterConfig {
    if (typeof value !== 'object' || value === null) {
        return DEFAULT_CONFIG;
    }
    const config = value as Partial<EditorBetterConfig>;
    return {
        editorOverrideEnabled: config.editorOverrideEnabled !== false,
    };
}

async function getConfig(): Promise<EditorBetterConfig> {
    const value = await window.GM_getValue?.(EDITOR_CONFIG_KEY, DEFAULT_CONFIG);
    return normalizeConfig(value);
}

function openSettings(): void {
    const existing = document.getElementById('wikidot-editor-better-settings');
    if (existing) {
        existing.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'wikidot-editor-better-settings';
    dialog.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.5);font:14px/1.5 system-ui,sans-serif;';
    const panel = document.createElement('form');
    panel.style.cssText = 'width:min(420px,100%);box-sizing:border-box;padding:20px;border-radius:10px;background:#fff;color:#222;box-shadow:0 12px 40px rgba(0,0,0,.35);';
    const title = document.createElement('h2');
    title.textContent = 'Wikidot Editor Better 设置';
    title.style.cssText = 'margin:0 0 16px;font-size:18px;';
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;gap:10px;align-items:flex-start;cursor:pointer;';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    const description = document.createElement('span');
    description.textContent = '启用完整编辑页覆写';
    label.append(checkbox, description);
    const hint = document.createElement('p');
    hint.textContent = '关闭后仍使用 Monaco 替换源码输入框，但保留 Wikidot 原生工具栏、按钮和页面版式。保存设置会刷新当前页面。';
    hint.style.cssText = 'margin:10px 0 18px;color:#666;';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = '保存并刷新';
    actions.append(cancel, save);
    panel.append(title, label, hint, actions);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    void getConfig().then((config) => {
        checkbox.checked = config.editorOverrideEnabled;
    });
    cancel.addEventListener('click', () => dialog.remove());
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
            dialog.remove();
        }
    });
    panel.addEventListener('submit', (event) => {
        event.preventDefault();
        const result = window.GM_setValue?.(EDITOR_CONFIG_KEY, {
            editorOverrideEnabled: checkbox.checked,
        });
        void Promise.resolve(result).then(() => window.location.reload());
    });
}

/**
 * 注入器（在 Tampermonkey 当前上下文执行，可能是隔离世界）。
 * 作用：将打包好的主世界引导脚本（bootstrap）注入页面主世界执行。
 * 核心逻辑全部在 bootstrap 内，从而绕开 Tampermonkey 隔离世界对
 * Monaco AMD 模块加载（DOM script + 全局 define）与动态 import 的限制。
 */
(async function () {
    'use strict';

    // 在 iframe 中不初始化，避免重复注入
    if (window.self !== window.top) {
        return;
    }

    window.GM_registerMenuCommand?.('Wikidot Editor Better 设置', openSettings);
    installIncludeRequestBridge();
    const config = await getConfig();

    try {
        // 若 bootstrap 已经在主世界执行过（页面存在），则跳过
        const script = document.createElement('script');
        script.textContent = `window.__wikidotEditorBetterConfig=${JSON.stringify(config)};${BOOTSTRAP_CODE}`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (e) {
        console.error('[Wikidot Editor Better] 主世界引导脚本注入失败:', e);
    }

    // 检查更新（异步，不阻塞编辑器初始化）
    checkUpdate();
})();
