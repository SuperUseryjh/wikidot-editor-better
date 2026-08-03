import {
    LOCAL_STORAGE_LAST_CHECK_TIME,
    PREVIEW_UPDATE_CHECK_INTERVAL,
    STATIC_BASE_URL,
    UPDATE_CHECK_INTERVAL,
    USERSCRIPT_FILE_NAME,
} from './constants';
import { log, logError } from './utils';
import { compareVersions } from './version';

/**
 * 检查脚本更新（在注入器/隔离世界上下文运行）。
 * 定期拉取静态站点的 version.json，发现新版本时通过 GM_notification 提示，
 * 点击通知后在新标签页打开新版本安装页。
 */
export function checkUpdate(): void {
    const currentScriptVersion = window.GM_info?.script?.version;
    if (!currentScriptVersion) {
        logError('无法获取当前脚本版本（GM_info 不可用），跳过更新检查。');
        return;
    }

    const lastCheckTime = parseInt(
        localStorage.getItem(LOCAL_STORAGE_LAST_CHECK_TIME) || '0',
        10
    );
    const now = Date.now();

    const isStandardVersion = /^[0-9]+\.[0-9]+\.[0-9]+$/.test(currentScriptVersion);
    const checkInterval = isStandardVersion
        ? UPDATE_CHECK_INTERVAL
        : PREVIEW_UPDATE_CHECK_INTERVAL;

    if (now - lastCheckTime < checkInterval) {
        log('距离上次检查更新时间不足，跳过更新检查。');
        return;
    }

    log('正在检查更新…');

    const versionPath = isStandardVersion ? 'pub' : 'perv';
    const updateUrl = `${STATIC_BASE_URL}/${versionPath}/version.json`;

    window.GM_xmlhttpRequest?.({
        method: 'GET',
        url: updateUrl,
        timeout: 15000,
        onload: (response) => {
            try {
                const remotePackageJson = JSON.parse(response.responseText);
                const remoteVersion = remotePackageJson.version;
                const comparison = typeof remoteVersion === 'string'
                    ? compareVersions(remoteVersion, currentScriptVersion)
                    : null;

                if (comparison === null) {
                    throw new Error(`版本号格式无效: ${String(remoteVersion)}`);
                }

                localStorage.setItem(LOCAL_STORAGE_LAST_CHECK_TIME, now.toString());

                if (comparison > 0) {
                    log(
                        `发现新版本！当前版本: ${currentScriptVersion}, 最新版本: ${remoteVersion}`
                    );
                    const userScriptUrl = `${STATIC_BASE_URL}/${versionPath}/${USERSCRIPT_FILE_NAME}`;
                    window.GM_notification?.({
                        title: 'Wikidot Editor Better 有新版本',
                        text: `当前 ${currentScriptVersion}，最新 ${remoteVersion}。点击通知前往更新。`,
                        timeout: 15000,
                        onclick: () => window.GM_openInTab?.(userScriptUrl, false),
                    });
                } else if (comparison === 0) {
                    log('当前已是最新版本。');
                } else {
                    log(`远端版本 ${remoteVersion} 不高于当前版本 ${currentScriptVersion}，跳过更新。`);
                }
            } catch (e) {
                logError('解析更新信息失败:', e);
            }
        },
        onerror: (response) => {
            logError('检查更新失败:', response.status, response.statusText);
        },
        ontimeout: () => {
            logError('检查更新超时。');
        },
    });
}
