/**
 * 常量定义
 */
export const MONACO_VERSION = '0.52.2';
export const MONACO_CDN = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min/vs`;

export const EDIT_TEXTAREA_ID = 'edit-page-textarea';
export const MONACO_CONTAINER_ID = 'wikidot-monaco-container';
export const MONACO_STATUS_ID = 'wikidot-monaco-status';
export const MONACO_ERROR_ID = 'wikidot-monaco-error';
export const MONACO_RETRY_DELAYS = [1000, 3000, 8000] as const;

export const FONT_SIZE_KEY = 'wikidotMonacoFontSize';
export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 30;

export const WIKIDOT_LANGUAGE_ID = 'wikidot';

/**
 * 更新检查（参考 ref 项目的自动更新机制）
 * 发布时 GitHub Actions 会把脚本与 package.json 推送到 SuperUseryjh/static 仓库的
 * wikidot-editor-better/pub（标准版本号）或 wikidot-editor-better/perv（预发布版本号）目录，
 * 由 static.yaoonion.fun 静态托管，脚本定期拉取 version.json 对比版本。
 */
export const STATIC_BASE_URL = 'https://static.yaoonion.fun/wikidot-editor-better';
export const USERSCRIPT_FILE_NAME = 'wikidot-editor-better.user.js';
export const LOCAL_STORAGE_LAST_CHECK_TIME = 'wikidotEditorBetterLastUpdateCheck';
export const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 标准版本：24 小时检查一次
export const PREVIEW_UPDATE_CHECK_INTERVAL = 1 * 60 * 60 * 1000; // 预发布版本：1 小时检查一次
