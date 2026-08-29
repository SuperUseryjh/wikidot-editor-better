import { BOOTSTRAP_CODE } from './generated/bootstrapCode';
import { checkUpdate } from './checkUpdate';
import { INCLUDE_REQUEST_EVENT, INCLUDE_RESPONSE_EVENT, MAX_FONT_SIZE, MIN_FONT_SIZE, OPEN_SETTINGS_EVENT } from './constants';
import { EditorBetterConfig, loadConfig, loadFontSize, saveConfig, saveFontSize } from './settingsStore';
import { platformReadCookie, platformRegisterMenuCommand, platformRequest } from './platform';

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

        const url = detail.url;
        const token = method === 'POST'
            ? /(?:^|&)wikidot_token7=([a-f0-9]+)$/i.exec(detail.data!)?.[1]
            : undefined;
        const respond = (ok: boolean, text = '', debug = '', headers = '', token?: string) => {
            const tokenFromHeader = token || WIKIDOT_TOKEN_PATTERN.exec(headers)?.[1];
            window.dispatchEvent(new CustomEvent(INCLUDE_RESPONSE_EVENT, {
                detail: { id: detail.id, ok, text: text.slice(0, MAX_INCLUDE_RESPONSE_LENGTH), debug, headers, token: tokenFromHeader },
            }));
        };

        void (async () => {
            console.debug('[Wikidot Editor Better][include bridge] 发起请求', { id: detail.id, method, url: detail.url });
            const result = await platformRequest({
                method,
                url,
                headers: method === 'POST' ? {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    ...(token ? { Cookie: 'wikidot_token7=' + token } : {}),
                } : undefined,
                data: method === 'POST' ? detail.data : undefined,
                // 跨域请求不保证共享 cookie jar。ViewSourceModule 需要表单字段与
                // cookie 中的 wikidot_token7 一致，因此仅为已通过白名单校验的
                // AMC POST 显式携带这个短期 token。
                timeout: 10_000,
            });

            if (!result.ok) {
                const debug = result.error === 'timeout' ? '请求超时（10 秒）' : '网络错误';
                console.error('[Wikidot Editor Better][include bridge] 请求失败', { id: detail.id, method, url: detail.url, error: result.error, status: result.status });
                respond(false, '', debug);
                return;
            }

            const diagnostic = 'HTTP ' + result.status + '，响应 ' + result.text.length + ' 字符';
            const headerToken = WIKIDOT_TOKEN_PATTERN.exec(result.headers)?.[1];
            let cookieToken: string | undefined;
            // Chromium 不会把 Set-Cookie 暴露给 responseHeaders，需要从 cookie 存储读取
            // 刚由此站写入的 token。
            if (method === 'GET' && !headerToken) {
                cookieToken = await platformReadCookie(url, 'wikidot_token7');
            }
            console.log('[Wikidot Editor Better][include bridge] 请求完成', { id: detail.id, method, url: detail.url, ok: result.ok, status: result.status, responseLength: result.text.length, tokenFoundInHeaders: Boolean(headerToken), tokenFoundInCookieStore: Boolean(cookieToken) });
            respond(result.ok, result.text, diagnostic, result.headers, cookieToken || headerToken);
        })();
    });
}

interface SettingOption {
    value: string;
    label: string;
}

interface SettingField {
    key: keyof EditorBetterConfig;
    label: string;
    type: 'boolean' | 'select' | 'number';
    options?: SettingOption[];
    min?: number;
    max?: number;
    step?: number;
}

const SETTING_FIELDS: SettingField[] = [
    { key: 'editorOverrideEnabled', label: '启用完整编辑页覆写', type: 'boolean' },
    { key: 'theme', label: '主题', type: 'select', options: [
        { value: 'system', label: '跟随系统' },
        { value: 'light', label: '亮色' },
        { value: 'dark', label: '暗色' },
    ] },
    { key: 'lineNumbers', label: '显示行号', type: 'boolean' },
    { key: 'minimap', label: '显示小地图', type: 'boolean' },
    { key: 'renderLineHighlight', label: '高亮当前行', type: 'select', options: [
        { value: 'none', label: '无' },
        { value: 'line', label: '行' },
        { value: 'all', label: '全部' },
    ] },
    { key: 'wordWrap', label: '自动换行', type: 'select', options: [
        { value: 'off', label: '关' },
        { value: 'on', label: '开' },
        { value: 'wordWrapColumn', label: '按列换行' },
    ] },
    { key: 'tabSize', label: 'Tab 宽度', type: 'select', options: [
        { value: '2', label: '2' },
        { value: '4', label: '4' },
        { value: '8', label: '8' },
    ] },
    { key: 'insertSpaces', label: '缩进用空格', type: 'boolean' },
    { key: 'folding', label: '代码折叠', type: 'boolean' },
    { key: 'bracketPairColorization', label: '括号配对着色', type: 'boolean' },
    { key: 'suggest', label: '自动补全', type: 'boolean' },
    { key: 'stickyScroll', label: 'Sticky Scroll', type: 'boolean' },
    { key: 'stickyScrollMaxLineCount', label: 'Sticky Scroll 保留行数', type: 'number', min: 1, max: 10 },
    { key: 'scrollBeyondLastLine', label: '可滚动过最后一行', type: 'boolean' },
];

function openSettings(): void {
    const existing = document.getElementById('wikidot-editor-better-settings');
    if (existing) {
        existing.remove();
    }

    const dialog = document.createElement('div');
    dialog.id = 'wikidot-editor-better-settings';
    dialog.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.5);font:14px/1.5 system-ui,sans-serif;';
    const panel = document.createElement('form');
    panel.style.cssText = 'width:min(480px,100%);max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:20px;border-radius:10px;background:#fff;color:#222;box-shadow:0 12px 40px rgba(0,0,0,.35);';
    const title = document.createElement('h2');
    title.textContent = 'Wikidot Editor Better 设置';
    title.style.cssText = 'margin:0 0 16px;font-size:18px;';
    panel.appendChild(title);

    const controls = new Map<keyof EditorBetterConfig, HTMLInputElement | HTMLSelectElement>();

    for (const field of SETTING_FIELDS) {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:12px;margin:0 0 12px;cursor:pointer;';
        const text = document.createElement('span');
        text.textContent = field.label;
        text.style.cssText = 'flex:1;';

        let control: HTMLInputElement | HTMLSelectElement;
        if (field.type === 'boolean') {
            const input = document.createElement('input');
            input.type = 'checkbox';
            control = input;
        } else if (field.type === 'select') {
            const select = document.createElement('select');
            for (const option of field.options ?? []) {
                const element = document.createElement('option');
                element.value = option.value;
                element.textContent = option.label;
                select.appendChild(element);
            }
            control = select;
        } else {
            const input = document.createElement('input');
            input.type = 'number';
            if (field.min !== undefined) input.min = String(field.min);
            if (field.max !== undefined) input.max = String(field.max);
            if (field.step !== undefined) input.step = String(field.step);
            control = input;
        }
        row.append(text, control);
        panel.appendChild(row);
        controls.set(field.key, control);
    }

    // 字号单独存 localStorage，与编辑页字号 +/- 按钮保持一致
    const fontSizeRow = document.createElement('label');
    fontSizeRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin:0 0 12px;cursor:pointer;';
    const fontSizeText = document.createElement('span');
    fontSizeText.textContent = '字体大小';
    fontSizeText.style.cssText = 'flex:1;';
    const fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.min = String(MIN_FONT_SIZE);
    fontSizeInput.max = String(MAX_FONT_SIZE);
    fontSizeInput.step = '1';
    fontSizeRow.append(fontSizeText, fontSizeInput);
    panel.appendChild(fontSizeRow);

    const hint = document.createElement('p');
    hint.textContent = '保存设置会刷新当前页面。';
    hint.style.cssText = 'margin:2px 0 14px;color:#666;';
    panel.appendChild(hint);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = '保存并刷新';
    actions.append(cancel, save);
    panel.appendChild(actions);

    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    void loadConfig().then((config) => {
        for (const field of SETTING_FIELDS) {
            const control = controls.get(field.key);
            if (!control) continue;
            if (field.type === 'boolean') {
                (control as HTMLInputElement).checked = Boolean(config[field.key]);
            } else if (field.type === 'select') {
                (control as HTMLSelectElement).value = String(config[field.key]);
            } else {
                (control as HTMLInputElement).value = String(config[field.key]);
            }
        }
        fontSizeInput.value = String(loadFontSize());
    });

    cancel.addEventListener('click', () => dialog.remove());
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
            dialog.remove();
        }
    });
    panel.addEventListener('submit', (event) => {
        event.preventDefault();
        const next: Record<string, unknown> = {};
        for (const field of SETTING_FIELDS) {
            const control = controls.get(field.key);
            if (!control) continue;
            if (field.type === 'boolean') {
                next[field.key] = (control as HTMLInputElement).checked;
            } else if (field.type === 'select') {
                next[field.key] = field.key === 'tabSize'
                    ? parseInt((control as HTMLSelectElement).value, 10)
                    : (control as HTMLSelectElement).value;
            } else {
                next[field.key] = parseInt((control as HTMLInputElement).value, 10);
            }
        }
        saveFontSize(parseInt(fontSizeInput.value, 10));
        void saveConfig(next).then(() => window.location.reload());
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

    platformRegisterMenuCommand('Wikidot Editor Better 设置', openSettings);
    window.addEventListener(OPEN_SETTINGS_EVENT, () => openSettings());
    installIncludeRequestBridge();
    const config = await loadConfig();

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
    void checkUpdate();
})();
