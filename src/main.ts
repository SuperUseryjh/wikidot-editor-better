import { BOOTSTRAP_CODE } from './generated/bootstrapCode';
import { checkUpdate } from './checkUpdate';

/**
 * 注入器（在 Tampermonkey 当前上下文执行，可能是隔离世界）。
 * 作用：将打包好的主世界引导脚本（bootstrap）注入页面主世界执行。
 * 核心逻辑全部在 bootstrap 内，从而绕开 Tampermonkey 隔离世界对
 * Monaco AMD 模块加载（DOM script + 全局 define）与动态 import 的限制。
 */
(function () {
    'use strict';

    // 在 iframe 中不初始化，避免重复注入
    if (window.self !== window.top) {
        return;
    }

    try {
        // 若 bootstrap 已经在主世界执行过（页面存在），则跳过
        const script = document.createElement('script');
        script.textContent = BOOTSTRAP_CODE;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (e) {
        console.error('[Wikidot Editor Better] 主世界引导脚本注入失败:', e);
    }

    // 检查更新（异步，不阻塞编辑器初始化）
    checkUpdate();
})();
