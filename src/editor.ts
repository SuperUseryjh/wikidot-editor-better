import {
    EDIT_TEXTAREA_ID,
    MONACO_CONTAINER_ID,
    MONACO_STATUS_ID,
    MONACO_ERROR_ID,
    WIKIDOT_LANGUAGE_ID,
    FONT_SIZE_KEY,
    DEFAULT_FONT_SIZE,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
} from './constants';
import { registerWikidotLanguage } from './wikidotLanguage';
import { log, logError } from './utils';

/**
 * textarea 属性代理的中间状态。
 * Monaco 未就绪前，所有读写都落到 shadow 变量上，就绪后转发到 Monaco。
 */
interface ProxyState {
    ready: boolean;
    editor: any;
    model: any;
    monaco: any;
    /** 内容缓存：cacheValid=false 表示 Monaco 内容已变化、缓存失效，读取时才重新展平 */
    cachedValue: string;
    cacheValid: boolean;
    shadowStart: number;
    shadowEnd: number;
    shadowScrollTop: number;
}

let currentProxy: { state: ProxyState; restore: () => void } | null = null;

/** 调用 wikidot 工具栏按钮（如 WIKIDOT.Editor.buttons.bold），按钮内部会操作被代理的 textarea */
function callWikiButton(fn: (...args: any[]) => void): void {
    if (typeof fn !== 'function') {
        return;
    }
    try {
        fn({});
    } catch (e) {
        logError('调用 WIKIDOT.Editor 按钮失败:', e);
    }
}

function clampFontSize(size: number): number {
    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
}

function getFontSize(): number {
    const saved = parseInt(localStorage.getItem(FONT_SIZE_KEY) || '', 10);
    return isNaN(saved) ? DEFAULT_FONT_SIZE : clampFontSize(saved);
}

export function clearMonacoError(textarea: HTMLTextAreaElement): void {
    textarea.parentElement?.querySelector(`#${MONACO_ERROR_ID}`)?.remove();
}

export function showMonacoError(textarea: HTMLTextAreaElement, onRetry: () => void): void {
    clearMonacoError(textarea);
    const error = document.createElement('div');
    error.id = MONACO_ERROR_ID;
    error.setAttribute('role', 'alert');
    error.style.cssText = 'width:95%;box-sizing:border-box;margin:0 0 8px;padding:10px 12px;border:1px solid #d99;background:#fff7e6;color:#7a4a00;font:14px/1.5 sans-serif;';

    const message = document.createElement('span');
    message.textContent = 'Monaco 编辑器加载失败，已切换回原生编辑框。';
    error.appendChild(message);

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '重试加载 Monaco';
    retry.style.cssText = 'margin-left:10px;padding:3px 8px;border:1px solid #b77;background:#fff;color:#7a4a00;cursor:pointer;';
    retry.addEventListener('click', () => {
        retry.disabled = true;
        retry.textContent = '正在重试…';
        onRetry();
    }, { once: true });
    error.appendChild(retry);
    textarea.parentNode?.insertBefore(error, textarea);
}

/**
 * 替换编辑区域为 Monaco Editor。
 * 通过给原 textarea 实例打属性补丁（value/选区/焦点），让 wikidot 的工具栏、
 * 快捷键、草稿、表单提交等逻辑无需改动即可继续工作。
 */
export async function setupEditor(monaco: any, textarea: HTMLTextAreaElement): Promise<void> {
    if (currentProxy) {
        currentProxy.restore();
        currentProxy = null;
    }

    // 极简诊断模式：不注册语言（plaintext）、不装代理、不绑快捷键，
    // 用于二分定位"Monaco 本体 vs 附加逻辑"导致的卡死。
    // 设置方式：localStorage.setItem('webMonacoMode','minimal') 后刷新页面
    const isMinimalMode = typeof localStorage !== 'undefined' && localStorage.getItem('webMonacoMode') === 'minimal';
    if (isMinimalMode) {
        log('极简诊断模式（webMonacoMode=minimal）：无 wikidot 语言 / 无代理 / 无快捷键');
    } else {
        registerWikidotLanguage(monaco);
    }

    // ---------- 1. 创建容器并插入到 textarea 之前 ----------
    const container = document.createElement('div');
    container.id = MONACO_CONTAINER_ID;
    container.style.cssText = `
        width: 95%;
        height: 65vh;
        min-height: 300px;
        border: 1px solid #ccc;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 4px;
        font-size: ${getFontSize()}px;
    `;
    textarea.parentNode?.insertBefore(container, textarea);

    const statusBar = document.createElement('div');
    statusBar.id = MONACO_STATUS_ID;
    statusBar.style.cssText = `
        width: 95%;
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 2px 6px;
        box-sizing: border-box;
        font: 12px/1.6 sans-serif;
        color: #666;
        border: 1px solid #ccc;
        border-top: none;
        border-radius: 0 0 4px 4px;
        background: #f7f7f7;
    `;
    statusBar.innerHTML = `<span id="${MONACO_STATUS_ID}-pos">Ln 1, Col 1</span><span>Wikidot · Monaco</span>`;
    container.after(statusBar);

    // ---------- 2. 初始化编辑器 ----------
    const state: ProxyState = {
        ready: false,
        editor: null,
        model: null,
        monaco,
        cachedValue: textarea.value,
        cacheValid: true,
        shadowStart: 0,
        shadowEnd: 0,
        shadowScrollTop: 0,
    };

    let editor: any;
    const t0 = performance.now();
    log('Monaco 编辑器创建开始…');
    try {
        editor = monaco.editor.create(container, {
            value: state.cachedValue,
            language: isMinimalMode ? 'plaintext' : WIKIDOT_LANGUAGE_ID,
            theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs',
            // 不使用 automaticLayout：Monaco 内部 ResizeObserver 在页面布局抖动时可能陷入
            // 无限 layout 循环导致整页卡死，改为手动节流 layout
            automaticLayout: false,
            // 后台 tokenize 放到 Web Worker：避免大文档在主线程 tokenize
            // 占满事件循环导致页面无响应
            backgroundTokenization: true,
            fontSize: getFontSize(),
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: false,
            wordWrap: 'off',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            lineNumbersMinChars: 3,
            folding: true,
            bracketPairColorization: { enabled: true },
            contextmenu: true,
            multiCursorModifier: 'ctrlCmd',
            placeholder: '输入 wikidot 源代码…',
            // 禁用自动补全弹层：输入时的大列表 DOM 在页面环境（扩展/旧站 CSS）下
            // 容易触发主线程重活，本脚本定位是纯编辑器，不需要 suggest
            suggest: { enabled: false },
        });
    } catch (e) {
        logError('Monaco 编辑器创建失败:', e);
        container.remove();
        statusBar.remove();
        throw e;
    }
    log(`Monaco 编辑器创建完成（耗时 ${Math.round(performance.now() - t0)}ms）`);
    state.editor = editor;
    state.model = editor.getModel();
    state.ready = true;
    state.editor.setScrollTop(state.shadowScrollTop);

    // 若 Monaco 加载期间 weditor 已往 textarea 写入内容，确保以最新值为准
    if (state.model.getValue() !== state.cachedValue) {
        state.model.setValue(state.cachedValue);
    }

    // 手动布局：窗口尺寸变化时（节流）调用 editor.layout()
    let layoutTimer: number | null = null;
    const onResize = (): void => {
        if (layoutTimer !== null) {
            window.clearTimeout(layoutTimer);
        }
        layoutTimer = window.setTimeout(() => {
            layoutTimer = null;
            state.editor?.layout();
        }, 150);
    };
    window.addEventListener('resize', onResize);

    // 状态栏
    const posEl = statusBar.querySelector(`#${MONACO_STATUS_ID}-pos`) as HTMLElement;
    let cursorChangeCount = 0;
    editor.onDidChangeCursorPosition((e: any) => {
        cursorChangeCount++;
        if (cursorChangeCount % 2000 === 0) {
            log(`[诊断] onDidChangeCursorPosition 已触发 ${cursorChangeCount} 次`);
        }
        posEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });
    let contentChangeCount = 0;
    editor.onDidChangeModelContent(() => {
        contentChangeCount++;
        if (contentChangeCount % 2000 === 0) {
            log(`[诊断] onDidChangeModelContent 已触发 ${contentChangeCount} 次`);
        }
        // 内容变化时只标记缓存失效，读取时才展平（避免大文档每次输入全量 getValue）
        state.cacheValid = false;
        // 极简诊断模式：内容直接写回 textarea（无代理时保证表单提交/草稿能拿到最新值）
        if (isMinimalMode) {
            textarea.value = state.model.getValue();
        }
    });

    log(`文档大小: ${state.model.getValueLength()} 字符`);

    // ---------- 3. 安装 textarea 属性代理 ----------
    if (!isMinimalMode) {
        const originalValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        const originalSelectionStart = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'selectionStart');
        const originalSelectionEnd = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'selectionEnd');
        const originalScrollTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');
        const originalFocus = textarea.focus;
        const originalSetSelectionRange = textarea.setSelectionRange;

    const getSelectionOffsets = (): [number, number] => {
        const sel = state.editor.getSelection();
        return [
            state.model.getOffsetAt(sel.getStartPosition()),
            state.model.getOffsetAt(sel.getEndPosition()),
        ];
    };

    Object.defineProperty(textarea, 'value', {
        configurable: true,
        get() {
            if (state.ready && !state.cacheValid) {
                // 惰性展平：仅在真正被读取时才执行全量 getValue
                state.cachedValue = state.model.getValue();
                state.cacheValid = true;
            }
            return state.cachedValue;
        },
        set(v: string) {
            const next = v == null ? '' : String(v);
            if (state.ready && !state.cacheValid) {
                state.cachedValue = state.model.getValue();
                state.cacheValid = true;
            }
            if (next === state.cachedValue) {
                return; // 内容未变化，避免无谓的全量 setValue
            }
            state.cachedValue = next;
            if (state.ready) {
                state.model.setValue(next);
            }
        },
    });

    Object.defineProperty(textarea, 'selectionStart', {
        configurable: true,
        get() {
            return state.ready ? getSelectionOffsets()[0] : state.shadowStart;
        },
        set(v: number) {
            const end = state.ready ? getSelectionOffsets()[1] : state.shadowEnd;
            textarea.setSelectionRange(v, end);
        },
    });

    Object.defineProperty(textarea, 'selectionEnd', {
        configurable: true,
        get() {
            return state.ready ? getSelectionOffsets()[1] : state.shadowEnd;
        },
        set(v: number) {
            const start = state.ready ? getSelectionOffsets()[0] : state.shadowStart;
            textarea.setSelectionRange(start, v);
        },
    });

    Object.defineProperty(textarea, 'scrollTop', {
        configurable: true,
        get() {
            return state.ready ? state.editor.getScrollTop() : state.shadowScrollTop;
        },
        set(v: number) {
            const next = Number.isFinite(v) ? Math.max(0, v) : 0;
            state.shadowScrollTop = next;
            if (state.ready) {
                state.editor.setScrollTop(next);
            }
        },
    });

    let inFocus = false;
    textarea.focus = function () {
        if (inFocus) {
            return;
        }
        if (state.ready) {
            inFocus = true;
            try {
                state.editor.focus();
            } finally {
                inFocus = false;
            }
        } else {
            originalFocus.call(textarea);
        }
    };

    // 隐藏原 textarea（保留在 DOM 中供表单提交）
    textarea.style.display = 'none';

    // ---------- 4. 快捷键：接管 wikidot 的 Ctrl+B/I/U ----------
    // 注意：Ctrl+S 不在此绑定。wikidot 的 keyBindSavePage 已在 document 层处理 ctrl+s，
    // Monaco 未绑定该键时事件会冒泡到 document，避免保存被触发两次。
    const keyMod = monaco.KeyMod.CtrlCmd;
    editor.addCommand(keyMod | monaco.KeyCode.KeyB, () => callWikiButton(window.WIKIDOT?.Editor?.buttons?.bold));
    editor.addCommand(keyMod | monaco.KeyCode.KeyI, () => callWikiButton(window.WIKIDOT?.Editor?.buttons?.italic));
    editor.addCommand(keyMod | monaco.KeyCode.KeyU, () => callWikiButton(window.WIKIDOT?.Editor?.buttons?.underline));

    // 防死锁：wikidot 事件处理器可能在 selectionchange/focusin 里写回 textarea 选区，
    // 经我们代理 → editor.setSelection → 又触发 selectionchange → 互相触发形成死循环。
    // 防重入锁打断同步递归，冷却期打断异步事件风暴。
    let inSetSelection = false;
    let lastSelectionWrite = 0;
    const SELECTION_COOLDOWN = 50;
    textarea.setSelectionRange = function (start: number, end: number) {
        if (inSetSelection) {
            return;
        }
        if (!state.ready) {
            state.shadowStart = start;
            state.shadowEnd = end;
            return;
        }
        const now = Date.now();
        if (now - lastSelectionWrite < SELECTION_COOLDOWN) {
            return; // 上一次写入触发的 selectionchange 回写，冷却期内忽略
        }
        lastSelectionWrite = now;
        inSetSelection = true;
        try {
            const sPos = state.model.getPositionAt(start);
            const ePos = state.model.getPositionAt(end);
            const selection = new state.monaco.Selection(
                sPos.lineNumber, sPos.column,
                ePos.lineNumber, ePos.column
            );
            state.editor.setSelection(selection);
            state.editor.revealRangeInCenterIfOutsideViewport(selection);
        } finally {
            inSetSelection = false;
        }
    };

    // Enter 键延续 wikidot 列表（* / # / : 前缀），还原原编辑器行为
    editor.onKeyDown((e: any) => {
        if (e.keyCode !== monaco.KeyCode.Enter || e.shiftKey || e.ctrlKey || e.altKey) {
            return;
        }
        const model = state.model;
        const line = model.getLineContent(model.getPosition().lineNumber);
        const m = line.match(/^(\s*)([*#:])\s+\S/);
        if (m) {
            // 阻止 Monaco 默认换行，改为换行 + 列表前缀
            e.preventDefault();
            e.stopPropagation();
            const prefix = m[1] + m[2] + ' ';
            editor.trigger('wikidot-list', 'type', { text: '\n' + prefix });
        }
    });

    // ---------- 5. 原 textarea 的行数 + / - 按钮改为调整 Monaco 字号 ----------
    const changeFontSize = (delta: number) => {
        const next = clampFontSize(getFontSize() + delta);
        localStorage.setItem(FONT_SIZE_KEY, String(next));
        editor.updateOptions({ fontSize: next });
        container.style.fontSize = `${next}px`;
        log(`字号已调整为 ${next}px`);
    };
    document.querySelectorAll<HTMLAnchorElement>('.change-textarea-size a').forEach((a) => {
        const onclick = a.getAttribute('onclick') || '';
        if (onclick.includes('changeTextareaRowNo')) {
            a.setAttribute('onclick', '');
            a.addEventListener('click', (ev) => {
                ev.preventDefault();
                changeFontSize(onclick.includes('-5') ? -1 : 1);
            });
        }
    });

    // 恢复函数：Monaco 加载失败或再次初始化时还原 textarea 原生行为
    const restore = () => {
        window.removeEventListener('resize', onResize);
        if (layoutTimer !== null) {
            window.clearTimeout(layoutTimer);
        }
        try {
            if (originalValue) {
                Object.defineProperty(textarea, 'value', originalValue as PropertyDescriptor);
            }
            if (originalSelectionStart) {
                Object.defineProperty(textarea, 'selectionStart', originalSelectionStart as PropertyDescriptor);
            }
            if (originalSelectionEnd) {
                Object.defineProperty(textarea, 'selectionEnd', originalSelectionEnd as PropertyDescriptor);
            }
            if (originalScrollTop) {
                Object.defineProperty(textarea, 'scrollTop', originalScrollTop as PropertyDescriptor);
            }
            const scrollTop = state.editor?.getScrollTop();
            if (Number.isFinite(scrollTop)) {
                textarea.scrollTop = Math.max(0, scrollTop);
            }
            textarea.focus = originalFocus;
            textarea.setSelectionRange = originalSetSelectionRange;
            textarea.style.display = '';
        } catch (e) {
            logError('恢复 textarea 代理失败:', e);
        }
        try {
            state.editor?.dispose();
        } catch (e) {
            /* 忽略 */
        }
        container.remove();
        statusBar.remove();
    };

        currentProxy = { state, restore };
    }

    log('Monaco 编辑器已接管编辑区域');
    return Promise.resolve();
}

/** Monaco 加载失败时的兜底：解除代理并恢复原 textarea 可见 */
export function rollbackIfNeeded(): void {
    if (currentProxy) {
        currentProxy.restore();
        currentProxy = null;
        log('Monaco 未就绪，已恢复原生 textarea');
    }
}
