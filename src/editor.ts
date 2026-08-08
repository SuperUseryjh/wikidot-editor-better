import {
    EDIT_TEXTAREA_ID,
    MONACO_CONTAINER_ID,
    MONACO_STATUS_ID,
    MONACO_ERROR_ID,
    EDITOR_STYLE_ID,
    WIKIDOT_LANGUAGE_ID,
    FONT_SIZE_KEY,
    DEFAULT_FONT_SIZE,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
} from './constants';
import {
    Bold,
    BookOpen,
    Braces,
    FileText,
    Eye,
    FileDiff,
    Heading1,
    Heading2,
    Heading3,
    Heading4,
    Heading5,
    Heading6,
    Image,
    AlignEndVertical,
    AlignStartVertical,
    Italic,
    Link,
    List,
    ListCollapse,
    ListOrdered,
    ListTree,
    Minus,
    Plus,
    Quote,
    Rows3,
    Save,
    SaveAll,
    SaveCheck,
    Sigma,
    Strikethrough,
    Subscript,
    Superscript,
    Table2,
    TextQuote,
    Type,
    Underline,
    X,
} from 'lucide';
import { registerWikidotLanguage } from './wikidotLanguage';
import { validateIncludes } from './includeValidator';
import { log, logError } from './utils';

/**
 * 编辑区美化样式。
 * 仅通过编辑区相关 ID / 表单属性（data-wm-theme）作用，不触碰页面版式覆写 CSS。
 * 明暗两套配色跟随 Monaco 主题（由 data-wm-theme 标记决定）。
 */
const EDITOR_STYLES = `
/* ===== wikidot-editor-better · 编辑区美化 ===== */

/* ---- 编辑工具栏（通用） ---- */
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel {
    width: 95%;
    box-sizing: border-box;
    margin: 0;
    padding: 5px 6px 7px;
    border: 1px solid;
    border-radius: 10px 10px 0 0;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div + div { margin-top: 2px; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1px;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li { position: relative; list-style: none; margin: 0; padding: 0; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel a {
    display: inline-block;
    padding: 3px 9px;
    text-decoration: none;
    font: 12px/1.6 "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
    border: 1px solid transparent;
    border-radius: 5px;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color .12s ease, color .12s ease;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li.hseparator { width: 1px; height: 16px; margin: 0 5px; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 999;
    flex-direction: column;
    align-items: stretch;
    min-width: 140px;
    padding: 4px;
    border: 1px solid;
    border-radius: 7px;
    box-shadow: 0 8px 22px rgba(0, 0, 0, .55);
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li:hover > ul { display: flex; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a { display: block; width: 100%; box-sizing: border-box; }

/* ---- 编辑区与状态栏（通用） ---- */
#wikidot-monaco-container { width: 95%; height: 65vh; min-height: 300px; overflow: hidden; border: 1px solid; border-top: none; border-radius: 0; }
#wikidot-monaco-status { width: 95%; display: flex; justify-content: space-between; gap: 12px; box-sizing: border-box; font: 12px/1.6 sans-serif; border: 1px solid; border-top: none; border-radius: 0 0 10px 10px; padding: 3px 10px; }
#wikidot-monaco-status span:last-child { font-weight: 600; }

/* ---- 字号按钮 / 底部按钮（通用） ---- */
#edit-page-form.wikidot-monaco-edit-page .change-textarea-size { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
#edit-page-form.wikidot-monaco-edit-page .change-textarea-size a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 26px;
    border: 1px solid;
    border-radius: 6px;
    font-weight: 700;
    text-decoration: none;
    transition: background-color .12s ease;
}
#edit-page-form.wikidot-monaco-edit-page .buttons input { border-radius: 6px; padding: 6px 16px; cursor: pointer; transition: filter .12s ease, transform .06s ease; }
#edit-page-form.wikidot-monaco-edit-page .buttons input:active { transform: translateY(1px); }

/* ---- 暗色主题（跟随 Monaco vs-dark） ---- */
#edit-page-form[data-wm-theme="dark"] {
    color: #c8c8cc;
    background: #1a1a1e;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 0;
    box-shadow: 0 8px 30px rgba(0, 0, 0, .35);
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="dark"] { background: linear-gradient(180deg, #2b2b30, #232327); border-color: #3a3a40; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="dark"] a { color: #cfcfd4; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="dark"] a:hover { background-color: #3c3c43; border-color: #4a4a52; color: #ffffff; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="dark"] li.hseparator { background: #4d4d55; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="dark"] li ul { background: #2b2b30; border-color: #4a4a52; }
#wikidot-monaco-container[data-wm-theme="dark"] { border-color: #3a3a40; box-shadow: 0 4px 16px rgba(0, 0, 0, .35); }
#wikidot-monaco-status[data-wm-theme="dark"] { color: #a9a9b0; background: #1e1e22; border-color: #3a3a40; }
#wikidot-monaco-status[data-wm-theme="dark"] span:last-child { color: #6a9955; }
#edit-page-form[data-wm-theme="dark"] .change-textarea-size a { color: #d4d4d4; background: #2b2b30; border-color: #3a3a40; }
#edit-page-form[data-wm-theme="dark"] .change-textarea-size a:hover { background-color: #3c3c43; color: #ffffff; }
#edit-page-form[data-wm-theme="dark"] #edit-page-title,
#edit-page-form[data-wm-theme="dark"] #edit-page-comments { color: #eee; background: #1f1f23; border: 1px solid #3a3a40; border-radius: 6px; }
#edit-page-form[data-wm-theme="dark"] #edit-page-title:focus,
#edit-page-form[data-wm-theme="dark"] #edit-page-comments:focus { outline: none; border-color: #0e639c; box-shadow: 0 0 0 3px rgba(14, 99, 156, .35); }

/* ---- 亮色主题（跟随 Monaco vs） ---- */
#edit-page-form[data-wm-theme="light"] {
    color: #333;
    background: #fdfdfd;
    border: 1px solid #d8d8d8;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, .08);
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="light"] { background: linear-gradient(180deg, #f7f7f7, #ececec); border-color: #d0d0d0; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="light"] a { color: #444; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="light"] a:hover { background-color: #e2e2e2; border-color: #c5c5c5; color: #111; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="light"] li.hseparator { background: #c8c8c8; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel[data-wm-theme="light"] li ul { background: #ffffff; border-color: #c5c5c5; }
#wikidot-monaco-container[data-wm-theme="light"] { border-color: #d0d0d0; box-shadow: 0 2px 10px rgba(0, 0, 0, .08); }
#wikidot-monaco-status[data-wm-theme="light"] { color: #666; background: #f4f4f4; border-color: #d0d0d0; }
#wikidot-monaco-status[data-wm-theme="light"] span:last-child { color: #2e7d32; }
#wikidot-monaco-container .monaco-hover,
.monaco-editor .monaco-hover {
    box-sizing: border-box;
    max-width: min(480px, calc(100vw - 24px));
}
#edit-page-form[data-wm-theme="light"] .change-textarea-size a { color: #444; background: #ffffff; border-color: #c8c8c8; }
#edit-page-form[data-wm-theme="light"] .change-textarea-size a:hover { background-color: #f0f0f0; color: #111; }
#edit-page-form[data-wm-theme="light"] #edit-page-title,
#edit-page-form[data-wm-theme="light"] #edit-page-comments { color: #222; background: #ffffff; border: 1px solid #c8c8c8; border-radius: 6px; }
#edit-page-form[data-wm-theme="light"] #edit-page-title:focus,
#edit-page-form[data-wm-theme="light"] #edit-page-comments:focus { outline: none; border-color: #0e639c; box-shadow: 0 0 0 3px rgba(14, 99, 156, .25); }

#action-area.wikidot-monaco-edit-page {
    max-width: 1280px;
    margin: 24px auto;
    padding: 0 20px;
}
#edit-page-form.wikidot-monaco-edit-page {
    box-sizing: border-box;
    width: 100%;
    padding: 20px;
}
#edit-page-form.wikidot-monaco-edit-page #edit-page-title,
#edit-page-form.wikidot-monaco-edit-page #edit-page-comments {
    box-sizing: border-box;
    width: 100%;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel,
#edit-page-form.wikidot-monaco-edit-page #wikidot-monaco-container,
#edit-page-form.wikidot-monaco-edit-page #wikidot-monaco-status {
    width: 100%;
    box-sizing: border-box;
}
#edit-page-form.wikidot-monaco-edit-page #wikidot-monaco-container {
    height: min(70vh, 900px);
    min-height: 420px;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel {
    display: grid;
    gap: 8px;
    margin: 16px 0 0;
    padding: 10px;
    border: 1px solid #d5d9df;
    border-radius: 10px 10px 0 0;
    background: #f7f9fc;
    box-shadow: 0 1px 2px rgba(15, 23, 42, .06);
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div + div { margin-top: 0; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div { display: flex; justify-content: center; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div > ul { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; width: 100%; gap: 4px; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel ul { gap: 4px; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li { display: block; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div > ul > li > a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 32px;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: #334155;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div > ul > li > a:hover,
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel > div > ul > li > a:focus-visible {
    border-color: #b9c7d8;
    background: #e8eef6;
    color: #0f4c81;
    outline: none;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li.hseparator {
    width: 1px;
    height: 22px;
    margin: 5px 5px;
    background: #d5d9df;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul {
    top: calc(100% + 4px);
    min-width: 180px;
    padding: 6px;
    border-color: #cbd5e1;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 10px 26px rgba(15, 23, 42, .18);
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a {
    display: flex;
    align-items: center;
    min-height: 30px;
    padding: 4px 8px;
    border-radius: 5px;
    color: #334155;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a:hover { background: #e8eef6; color: #0f4c81; }
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel {
    border-color: #3a3f4b;
    background: #22262d;
    box-shadow: 0 1px 2px rgba(0, 0, 0, .35);
}
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel > div > ul > li > a { color: #d4d8e0; }
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel > div > ul > li > a:hover,
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel > div > ul > li > a:focus-visible { border-color: #4a6178; background: #303945; color: #fff; }
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel li.hseparator { background: #424b58; }
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel li ul {
    border-color: #424b58;
    background: #282d35 !important;
}
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel li ul a { color: #d4d8e0; }
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel li ul a {
    background-color: #282d35 !important;
}
#edit-page-form[data-wm-theme="dark"] #wd-editor-toolbar-panel li ul a:hover {
    background-color: #303945 !important;
    color: #fff;
}
#odialog-hovertips .hovertip {
    box-sizing: border-box;
    max-width: min(320px, calc(100vw - 24px));
    padding: 8px 10px !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px;
    background: #fff !important;
    color: #334155;
    font: 13px/1.45 system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(15, 23, 42, .18);
}
#odialog-hovertips { z-index: 1001 !important; }
#odialog-hovertips .hovertip .content { padding: 0; }
@media (prefers-color-scheme: dark) {
    #odialog-hovertips .hovertip {
        border-color: #424b58 !important;
        background: #282d35 !important;
        color: #d4d8e0;
        box-shadow: 0 8px 24px rgba(0, 0, 0, .4);
    }
}
#edit-page-form.wikidot-monaco-edit-page .edit-page-bottomtable {
    display: table;
    width: 100%;
    margin-top: 18px;
    border-collapse: separate;
    border-spacing: 12px;
    background: transparent;
}
#edit-page-form.wikidot-monaco-edit-page .edit-page-bottomtable td {
    box-sizing: border-box;
    width: 50%;
    padding: 14px !important;
    vertical-align: top;
    border: 1px solid #d5d9df !important;
    border-radius: 8px;
    background: #f8fafc;
}
#edit-page-form.wikidot-monaco-edit-page #lock-info {
    min-height: 100%;
    margin: 0;
    padding: 12px 14px;
    border: 1px solid #86c5e8;
    border-radius: 6px;
    background: #e8f5fc;
    color: #075985;
    font: 13px/1.65 system-ui, sans-serif;
}
#edit-page-form.wikidot-monaco-edit-page #lock-info strong,
#edit-page-form.wikidot-monaco-edit-page #lock-timer { color: #0369a1; font-weight: 700; }
#edit-page-form[data-wm-theme="dark"] .edit-page-bottomtable td { border-color: #3a3f4b !important; background: #22262d; }
#edit-page-form[data-wm-theme="dark"] #lock-info { border-color: #285a78; background: #142c3d; color: #b9e4fb; }
#edit-page-form[data-wm-theme="dark"] #lock-info strong,
#edit-page-form[data-wm-theme="dark"] #lock-timer { color: #7dd3fc; }
#edit-page-form.wikidot-monaco-edit-page .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
}
#edit-page-form.wikidot-monaco-edit-page .buttons input.wikidot-monaco-native-action {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
}
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    padding: 7px 13px;
    border: 1px solid #b8b8b8;
    border-radius: 6px;
    background: #fff;
    color: #333;
    font: 600 13px/1.2 system-ui, sans-serif;
    cursor: pointer;
}
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button:hover { filter: brightness(.95); }
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button:focus-visible { outline: 3px solid rgba(14, 99, 156, .35); outline-offset: 2px; }
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button:disabled { cursor: wait; opacity: .7; }
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button svg { width: 16px; height: 16px; stroke-width: 2; }
#edit-page-form[data-wm-theme="dark"] .wikidot-monaco-action-button { color: #e8e8ec; background: #2b2b30; border-color: #4a4a52; }
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button[data-wm-action="cancel"] { color: #b42318; border-color: #e0a5a0; }
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button[data-wm-action="diff"] { color: #075985; border-color: #86c5e8; background: #f0f9ff; }
#edit-page-form.wikidot-monaco-edit-page .wikidot-monaco-action-button[data-wm-action="save"] { color: #fff; background: #0e639c; border-color: #0e639c; }
#edit-page-form[data-wm-theme="dark"] .wikidot-monaco-action-button[data-wm-action="diff"] { color: #bae6fd; border-color: #285a78; background: #142c3d; }
#view-diff-div.wikidot-monaco-diff {
    max-width: 1280px;
    box-sizing: border-box;
    margin: 16px auto 24px;
    padding: 16px;
    overflow-x: auto;
    border: 1px solid #c8c8c8;
    border-radius: 6px;
    background: #fff;
    color: #333;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .12);
    font: 13px/1.45 Consolas, "Cascadia Code", "SFMono-Regular", monospace;
}
#view-diff-div.wikidot-monaco-diff:empty { display: none; }
#view-diff-div.wikidot-monaco-diff table { width: 100%; border-collapse: collapse; border-spacing: 0; }
#view-diff-div.wikidot-monaco-diff th,
#view-diff-div.wikidot-monaco-diff td { padding: 3px 10px; border: none; text-align: left; vertical-align: top; }
#view-diff-div.wikidot-monaco-diff th { padding: 7px 10px; border: none; background: #f3f3f3; color: #333; font-family: system-ui, sans-serif; font-weight: 600; }
#view-diff-div.wikidot-monaco-diff ins {
    padding: 0 2px;
    border-radius: 0;
    background: rgba(155, 185, 85, .42);
    color: inherit;
    box-shadow: none;
    font-weight: inherit;
    text-decoration: none;
}
#view-diff-div.wikidot-monaco-diff del {
    padding: 0 2px;
    border-radius: 0;
    background: rgba(255, 0, 0, .22);
    color: inherit;
    box-shadow: none;
    font-weight: inherit;
}
#view-diff-div.wikidot-monaco-diff tr:has(ins) > td { background: rgba(155, 185, 85, .22); }
#view-diff-div.wikidot-monaco-diff tr:has(del) > td { background: rgba(255, 0, 0, .10); }
#view-diff-div.wikidot-monaco-diff pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
#view-diff-div.wikidot-monaco-diff[data-wm-theme="dark"] { border-color: #454545; background: #1e1e1e; color: #d4d4d4; box-shadow: 0 2px 8px rgba(0, 0, 0, .45); }
#view-diff-div.wikidot-monaco-diff[data-wm-theme="dark"] th { background: #252526; color: #cccccc; }
#view-diff-div.wikidot-monaco-diff[data-wm-theme="dark"] ins { background: rgba(155, 185, 85, .38); color: inherit; }
#view-diff-div.wikidot-monaco-diff[data-wm-theme="dark"] del { background: rgba(255, 0, 0, .28); color: inherit; }
#view-diff-div.wikidot-monaco-diff[data-wm-theme="dark"] tr:has(ins) > td { background: rgba(155, 185, 85, .16); }
#view-diff-div.wikidot-monaco-diff[data-wm-theme="dark"] tr:has(del) > td { background: rgba(255, 0, 0, .14); }
#edit-page-form.wikidot-monaco-edit-page .change-textarea-size a { font-size: 0; }
#edit-page-form.wikidot-monaco-edit-page .change-textarea-size a svg { width: 15px; height: 15px; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel a.wikidot-monaco-mask-icon { font-size: 0; min-width: 30px; min-height: 28px; box-sizing: border-box; text-align: center; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel a.wikidot-monaco-mask-icon::before {
    content: '';
    display: block;
    width: 16px;
    height: 16px;
    background-color: currentColor;
    mask: var(--wm-toolbar-icon) center / contain no-repeat;
    -webkit-mask: var(--wm-toolbar-icon) center / contain no-repeat;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a { font-size: 12px; }
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a.wikidot-monaco-mask-icon {
    display: flex !important;
    font-size: 0;
    background-image: none !important;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a.wikidot-monaco-mask-icon::before {
    display: block !important;
    flex: 0 0 16px;
    margin-right: 6px;
}
#edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel li ul a.wikidot-monaco-mask-icon > span {
    font-size: 12px;
    line-height: 16px;
}
@supports not ((mask: url('') center / contain no-repeat) or (-webkit-mask: url('') center / contain no-repeat)) {
    #edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel a.wikidot-monaco-mask-icon { font-size: 12px; }
    #edit-page-form.wikidot-monaco-edit-page #wd-editor-toolbar-panel a.wikidot-monaco-mask-icon::before { display: none; }
}
@media (max-width: 640px) {
    #action-area.wikidot-monaco-edit-page { margin: 12px auto; padding: 0 8px; }
    #edit-page-form.wikidot-monaco-edit-page { padding: 12px; }
    #edit-page-form.wikidot-monaco-edit-page #wikidot-monaco-container { min-height: 360px; height: 60vh; }
    #edit-page-form.wikidot-monaco-edit-page .buttons { justify-content: stretch; }
    #edit-page-form.wikidot-monaco-edit-page .buttons input { flex: 1 1 120px; }
}
`;

/** 注入编辑区美化样式（幂等：同 id 只注入一次） */
function injectEditorStyles(fullOverride: boolean): void {
    const existingStyle = document.getElementById(EDITOR_STYLE_ID);
    if (existingStyle) {
        return;
    }
    const style = document.createElement('style');
    style.id = EDITOR_STYLE_ID;
    style.textContent = fullOverride ? EDITOR_STYLES : `
#wikidot-monaco-container { width: 95%; height: 65vh; min-height: 300px; overflow: hidden; }
#wikidot-monaco-status { width: 95%; display: flex; justify-content: space-between; gap: 12px; box-sizing: border-box; font: 12px/1.6 sans-serif; padding: 3px 10px; }
`;
    document.head.appendChild(style);
}

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

type IconNode = [string, Record<string, string | number | undefined>][];

const TOOLBAR_ICONS: Record<string, IconNode> = {
    'weditor-h1': Heading1,
    'weditor-h2': Heading2,
    'weditor-h3': Heading3,
    'weditor-h4': Heading4,
    'weditor-h5': Heading5,
    'weditor-h6': Heading6,
    'weditor-bold': Bold,
    'weditor-italic': Italic,
    'weditor-underline': Underline,
    'weditor-strikethrough': Strikethrough,
    'weditor-teletype': Type,
    'weditor-quote': Quote,
    'weditor-superscript': Superscript,
    'weditor-subscript': Subscript,
    'weditor-raw': Braces,
    'weditor-hr': Minus,
    'weditor-div': Braces,
    'weditor-clearfloat': Rows3,
    'weditor-clearfloatleft': AlignStartVertical,
    'weditor-clearfloatright': AlignEndVertical,
    'weditor-table': Table2,
    'weditor-toc': List,
    'weditor-code': Braces,
    'weditor-codewiz': Braces,
    'weditor-uri': Link,
    'weditor-uriwiz': Link,
    'weditor-pagelink': Link,
    'weditor-pagelinkwiz': Link,
    'weditor-image': Image,
    'weditor-imagewiz': Image,
    'weditor-html': FileText,
    'weditor-numlist': ListOrdered,
    'weditor-bullist': ListTree,
    'weditor-incindent': ListCollapse,
    'weditor-decindent': ListCollapse,
    'weditor-deflist': List,
    'weditor-footnote': TextQuote,
    'weditor-math': Sigma,
    'weditor-mathinline': Sigma,
    'weditor-eqref': Sigma,
    'weditor-bib': BookOpen,
    'weditor-bibcite': Quote,
};

const ACTION_ICONS: Record<string, IconNode> = {
    cancel: X,
    diff: FileDiff,
    preview: Eye,
    'save-draft': Save,
    'save-continue': SaveAll,
    save: SaveCheck,
};

function createIcon(icon: IconNode, className: string): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add(className);
    for (const [tag, attributes] of icon) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [name, value] of Object.entries(attributes)) {
            if (value !== undefined) {
                element.setAttribute(name, String(value));
            }
        }
        svg.appendChild(element);
    }
    return svg;
}

function createIconMask(icon: IconNode): string {
    const content = icon.map(([tag, attributes]) => {
        const serializedAttributes = Object.entries(attributes)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => `${name}="${String(value)}"`)
            .join(' ');
        return `<${tag} ${serializedAttributes}/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function enhanceButtons(form: HTMLFormElement): () => void {
    const toolbarLinks: HTMLAnchorElement[] = [];
    const decorateToolbar = (): void => {
        form.querySelectorAll<HTMLAnchorElement>('#wd-editor-toolbar-panel a').forEach((link) => {
            if (link.classList.contains('wikidot-monaco-mask-icon')) {
                return;
            }
            const icon = Object.entries(TOOLBAR_ICONS).find(([className]) => link.classList.contains(className))?.[1];
            if (!icon) {
                return;
            }
            const label = link.textContent?.trim();
            if (label) {
                link.setAttribute('aria-label', label);
                link.setAttribute('title', label);
            }
            link.style.setProperty('--wm-toolbar-icon', createIconMask(icon));
            link.classList.add('wikidot-monaco-mask-icon');
            toolbarLinks.push(link);
        });
    };
    decorateToolbar();
    const toolbar = form.querySelector('#wd-editor-toolbar-panel');
    let toolbarObserver: MutationObserver | null = null;
    if (toolbar) {
        toolbarObserver = new MutationObserver(decorateToolbar);
        toolbarObserver.observe(toolbar, { childList: true, subtree: true });
    }

    const sizeIcons: Array<{
        link: HTMLAnchorElement;
        children: Node[];
        ariaLabel: string | null;
    }> = [];
    form.querySelectorAll<HTMLAnchorElement>('.change-textarea-size a').forEach((link) => {
        const icon = link.textContent?.trim() === '-' ? Minus : Plus;
        const children = Array.from(link.childNodes, (node) => node.cloneNode(true));
        const ariaLabel = link.getAttribute('aria-label');
        const svg = createIcon(icon, 'wikidot-monaco-toolbar-icon');
        link.replaceChildren(svg);
        link.setAttribute('aria-label', icon === Minus ? '减小字号' : '增大字号');
        sizeIcons.push({ link, children, ariaLabel });
    });

    const proxies: HTMLButtonElement[] = [];
    const nativeInputs: HTMLInputElement[] = [];
    form.querySelectorAll<HTMLInputElement>('.buttons input').forEach((input) => {
        const action = input.name;
        const icon = ACTION_ICONS[action];
        if (!icon) {
            return;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wikidot-monaco-action-button';
        button.dataset.wmAction = action;
        button.append(createIcon(icon, 'wikidot-monaco-action-icon'));
        button.append(document.createTextNode(input.value));
        button.addEventListener('click', () => {
            if (button.disabled) {
                return;
            }
            const label = input.value;
            button.disabled = true;
            button.replaceChildren(createIcon(icon, 'wikidot-monaco-action-icon'), document.createTextNode('加载中…'));
            if (action === 'diff') {
                const diffContainer = document.getElementById('view-diff-div');
                if (diffContainer) {
                    diffContainer.classList.add('wikidot-monaco-diff');
                    diffContainer.setAttribute('data-wm-theme', form.getAttribute('data-wm-theme') || 'light');
                }
            }
            input.click();
            window.setTimeout(() => {
                if (!button.isConnected) {
                    return;
                }
                button.disabled = false;
                button.replaceChildren(createIcon(icon, 'wikidot-monaco-action-icon'), document.createTextNode(label));
            }, 3000);
        });
        input.classList.add('wikidot-monaco-native-action');
        input.after(button);
        proxies.push(button);
        nativeInputs.push(input);
    });

    return () => {
        toolbarObserver?.disconnect();
        toolbarLinks.forEach((link) => {
            link.style.removeProperty('--wm-toolbar-icon');
            link.classList.remove('wikidot-monaco-mask-icon');
        });
        sizeIcons.forEach(({ link, children, ariaLabel }) => {
            link.replaceChildren(...children);
            if (ariaLabel === null) {
                link.removeAttribute('aria-label');
            } else {
                link.setAttribute('aria-label', ariaLabel);
            }
        });
        proxies.forEach((button) => button.remove());
        nativeInputs.forEach((input) => input.classList.remove('wikidot-monaco-native-action'));
    };
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

    // 主题跟随系统深浅色；编辑区外框配色也据此切换
    const isDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const wmTheme = isDark ? 'dark' : 'light';
    const form = textarea.closest('form');
    const actionArea = form?.closest('#action-area');
    const fullOverride = (window as any).__wikidotEditorBetterConfig?.editorOverrideEnabled !== false;

    // ---------- 1. 创建容器并插入到 textarea 之前 ----------
    injectEditorStyles(fullOverride);
    const container = document.createElement('div');
    container.id = MONACO_CONTAINER_ID;
    container.setAttribute('data-wm-theme', wmTheme);
    textarea.parentNode?.insertBefore(container, textarea);

    const statusBar = document.createElement('div');
    statusBar.id = MONACO_STATUS_ID;
    statusBar.setAttribute('data-wm-theme', wmTheme);
    statusBar.innerHTML = `<span id="${MONACO_STATUS_ID}-pos">Ln 1, Col 1</span><span>Wikidot · Monaco</span>`;
    container.after(statusBar);

    // 编辑工具栏与编辑表单标记主题，使外框配色与 Monaco 一致
    if (fullOverride) {
        form?.classList.add('wikidot-monaco-edit-page');
        actionArea?.classList.add('wikidot-monaco-edit-page');
        form?.querySelector('#wd-editor-toolbar-panel')?.setAttribute('data-wm-theme', wmTheme);
        form?.setAttribute('data-wm-theme', wmTheme);
    }
    const restoreButtons = fullOverride && form ? enhanceButtons(form) : () => undefined;

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
            theme: isDark ? 'vs-dark' : 'vs',
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
            stickyScroll: { enabled: true, maxLineCount: 5 },
            bracketPairColorization: { enabled: true },
            contextmenu: true,
            // The editor container intentionally clips layout overflow. Keep Monaco's
            // diagnostic hovers in its fixed viewport layer so they are not clipped
            // when a marker is close to the editor edge.
            fixedOverflowWidgets: true,
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
    let includeValidationTimer: number | null = null;
    let includeValidationRun = 0;
    const scheduleIncludeValidation = () => {
        includeValidationRun++;
        if (isMinimalMode) {
            return;
        }
        if (includeValidationTimer !== null) {
            window.clearTimeout(includeValidationTimer);
        }
        includeValidationTimer = window.setTimeout(() => {
            includeValidationTimer = null;
            const run = includeValidationRun;
            void validateIncludes(monaco, state.model).catch((error: unknown) => {
                if (run === includeValidationRun) {
                    logError('include 校验失败:', error);
                }
            });
        }, 1200);
    };
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
        scheduleIncludeValidation();
    });

    log(`文档大小: ${state.model.getValueLength()} 字符`);
    scheduleIncludeValidation();

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
                state.editor.executeEdits('wikidot-toolbar', [{
                    range: state.model.getFullModelRange(),
                    text: next,
                    forceMoveMarkers: true,
                }]);
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
        const line = model.getLineContent(editor.getPosition().lineNumber);
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
        log(`字号已调整为 ${next}px`);
    };
    const restoreFontSizeControls: Array<() => void> = [];
    form?.querySelectorAll<HTMLAnchorElement>('.change-textarea-size a').forEach((a) => {
        const onclick = a.getAttribute('onclick') || '';
        if (onclick.includes('changeTextareaRowNo')) {
            a.setAttribute('onclick', '');
            const onClick = (ev: MouseEvent) => {
                ev.preventDefault();
                changeFontSize(onclick.includes('-5') ? -1 : 1);
            };
            a.addEventListener('click', onClick);
            restoreFontSizeControls.push(() => {
                a.removeEventListener('click', onClick);
                if (onclick) {
                    a.setAttribute('onclick', onclick);
                } else {
                    a.removeAttribute('onclick');
                }
            });
        }
    });

    // 恢复函数：Monaco 加载失败或再次初始化时还原 textarea 原生行为
    const restore = () => {
        window.removeEventListener('resize', onResize);
        if (layoutTimer !== null) {
            window.clearTimeout(layoutTimer);
        }
        if (includeValidationTimer !== null) {
            window.clearTimeout(includeValidationTimer);
        }
        includeValidationRun++;
        monaco.editor.setModelMarkers(state.model, 'wikidot-include-validator', []);
        restoreFontSizeControls.forEach((restoreControl) => restoreControl());
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
            form?.classList.remove('wikidot-monaco-edit-page');
            actionArea?.classList.remove('wikidot-monaco-edit-page');
            form?.removeAttribute('data-wm-theme');
            form?.querySelector('#wd-editor-toolbar-panel')?.removeAttribute('data-wm-theme');
            restoreButtons();
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
