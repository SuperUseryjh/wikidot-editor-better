/**
 * 全局类型声明：Monaco 运行时对象、AMD require 等
 */
export {};

declare global {
    interface Window {
        require?: any;
        define?: any;
        MonacoEnvironment?: any;
        monaco?: any;
        // wikidot 全局
        WIKIDOT?: any;
        $?: any;
        $j?: any;
        OZONE?: any;
        YAHOO?: any;
        // Tampermonkey API（在注入器/隔离世界上下文中可用）
        GM_xmlhttpRequest?: (details: GMXmlHttpRequestDetails) => void;
        GM_cookie?: {
            list: (details: { url: string; name?: string }, callback: (cookies: GMCookie[]) => void) => void;
        };
        GM_openInTab?: (url: string, open_in_background?: boolean) => Window | null;
        GM_notification?: (details: GMNotificationDetails) => void;
        GM_info?: { script: { version: string } };
        GM_getValue?: <T>(key: string, defaultValue: T) => T | Promise<T>;
        GM_setValue?: <T>(key: string, value: T) => void | Promise<void>;
        GM_registerMenuCommand?: (caption: string, commandFunc: () => void) => void;
    }
}

/** Tampermonkey GM_cookie 返回的最小 cookie 结构。 */
export interface GMCookie {
    name: string;
    value: string;
}

/** GM_xmlhttpRequest 请求参数（仅声明本脚本用到的字段） */
export interface GMXmlHttpRequestDetails {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
    url: string;
    headers?: { [key: string]: string };
    data?: string;
    timeout?: number;
    onload?: (response: GMXmlHttpRequestResponse) => void;
    onerror?: (response: GMXmlHttpRequestResponse) => void;
    ontimeout?: () => void;
}

/** GM_xmlhttpRequest 响应 */
export interface GMXmlHttpRequestResponse {
    status: number;
    statusText: string;
    responseText: string;
    responseHeaders: string;
    finalUrl: string;
    readyState: number;
    response: any;
}

/** GM_notification 参数 */
export interface GMNotificationDetails {
    text?: string;
    title?: string;
    image?: string;
    highlight?: boolean;
    silent?: boolean;
    timeout?: number;
    onclick?: () => void;
    ondone?: () => void;
    onerror?: (error: any) => void;
}
