import { BOOTSTRAP_CODE } from './generated/bootstrapCode';
import { checkUpdate } from './checkUpdate';
import { EDITOR_CONFIG_KEY } from './constants';

interface EditorBetterConfig {
    editorOverrideEnabled: boolean;
}

const DEFAULT_CONFIG: EditorBetterConfig = {
    editorOverrideEnabled: true,
};

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
