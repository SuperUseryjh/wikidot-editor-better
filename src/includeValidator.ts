import { INCLUDE_REQUEST_EVENT, INCLUDE_RESPONSE_EVENT } from './constants';

export interface IncludeParameter {
    name: string;
    value: string;
    start: number;
    end: number;
}

export interface IncludeValidationIssue {
    start: number;
    end: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

export interface IncludeDirective {
    page: string;
    pageStart: number;
    pageEnd: number;
    parameters: IncludeParameter[];
    errors: IncludeValidationIssue[];
}

interface PageValidationResult {
    exists: boolean | null;
    usedParameters: Set<string> | null;
}

interface TextResponse {
    ok: boolean;
    text: string;
    debug?: string;
    headers?: string;
    token?: string;
}

export interface IncludeTarget {
    page: string;
    origin: string;
    remote: boolean;
}

const INCLUDE_PATTERN = /\[\[include\s+([^\s\]]+)([\s\S]*?)\]\]/gi;
const PARAMETER_NAME_PATTERN = /^[\p{L}_][\p{L}\p{N}_-]*$/u;
const PARAMETER_REFERENCE_PATTERN = /\{\$([\p{L}_][\p{L}\p{N}_-]*)\}/gu;
const SOURCE_TEXTAREA_PATTERN = /<textarea\b[^>]*\bid=["']edit-page-textarea["'][^>]*>([\s\S]*?)<\/textarea>/i;
const ANY_TEXTAREA_PATTERN = /<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i;
const SOURCE_TIMEOUT = 10000;
const PAGE_VALIDATION_CACHE_TTL = 10 * 60 * 1000;
let includeRequestSequence = 0;
const pageValidationCache = new Map<string, { expiresAt: number; result: PageValidationResult }>();
const pendingPageValidations = new Map<string, Promise<PageValidationResult>>();

function debug(...args: unknown[]): void {
    console.debug('[Wikidot Editor Better][include]', ...args);
}

function info(...args: unknown[]): void {
    console.debug('[Wikidot Editor Better][include]', ...args);
}

function debugError(...args: unknown[]): void {
    console.error('[Wikidot Editor Better][include]', ...args);
}

function decodeHtml(value: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function splitArguments(value: string, offset: number): Array<{ value: string; start: number; end: number }> {
    const result: Array<{ value: string; start: number; end: number }> = [];
    const matcher = /(?:[^\s"']+|"[^"]*"|'[^']*')+/g;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(value))) {
        result.push({ value: match[0], start: offset + match.index, end: offset + match.index + match[0].length });
    }
    return result;
}

export function parseIncludeDirectives(source: string): IncludeDirective[] {
    const directives: IncludeDirective[] = [];
    let match: RegExpExecArray | null;
    while ((match = INCLUDE_PATTERN.exec(source))) {
        const page = match[1];
        const pageStart = match.index + match[0].indexOf(page);
        const parameters: IncludeParameter[] = [];
        const errors: IncludeValidationIssue[] = [];
        const names = new Set<string>();

        for (const rawArgument of splitArguments(match[2], pageStart + page.length)) {
            let value = rawArgument.value;
            let start = rawArgument.start;

            // Wikidot allows a pipe to continue include parameters on a new line.
            // It is a separator, never part of the parameter name.
            while (value.startsWith('|')) {
                value = value.slice(1);
                start++;
            }
            if (!value) {
                continue;
            }

            const separator = value.indexOf('=');
            if (separator <= 0) {
                errors.push({ start, end: rawArgument.end, message: 'include 参数必须使用 name=value 形式。', severity: 'error' });
                continue;
            }
            const name = value.slice(0, separator);
            if (!PARAMETER_NAME_PATTERN.test(name)) {
                errors.push({ start, end: start + name.length, message: '参数名 "' + name + '" 无效。', severity: 'error' });
                continue;
            }
            if (names.has(name)) {
                errors.push({ start, end: start + name.length, message: '参数 "' + name + '" 重复传入。', severity: 'error' });
                continue;
            }
            names.add(name);
            parameters.push({ name, value: value.slice(separator + 1), start, end: rawArgument.end });
        }
        directives.push({ page, pageStart, pageEnd: pageStart + page.length, parameters, errors });
    }
    return directives;
}

export function parseIncludeTarget(value: string, currentOrigin = window.location.origin): IncludeTarget | null {
    // 只有以冒号开头、形如 ":站点名:页面名" 的引用才是跨站引用。
    // 不以冒号开头的一律视为当前站点内的页面引用，页面名本身可含冒号（如 component:image-block）。
    if (!value.startsWith(':')) {
        return value ? { page: value, origin: currentOrigin, remote: false } : null;
    }

    const target = value.slice(1);
    const separator = target.indexOf(':');
    if (separator === -1) {
        return target ? { page: target, origin: currentOrigin, remote: false } : null;
    }

    const site = target.slice(0, separator);
    const page = target.slice(separator + 1);
    if (!site || !page) return null;

    const origin = 'https://' + site + '.wikidot.com';
    return { page, origin, remote: origin !== currentOrigin };
}

async function fetchText(url: URL): Promise<TextResponse> {
    debug('请求被 include 页面', { url: url.href, crossOrigin: url.origin !== window.location.origin });
    if (url.origin !== window.location.origin) {
        return fetchCrossOriginText(url);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SOURCE_TIMEOUT);
    try {
        const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
        const text = response.ok ? await response.text() : '';
        debug('被 include 页面响应', { url: url.href, status: response.status, length: text.length });
        return { ok: response.ok, text };
    } finally {
        window.clearTimeout(timeout);
    }
}

function fetchCrossOriginText(url: URL, method: 'GET' | 'POST' = 'GET', data?: string): Promise<TextResponse> {
    return new Promise((resolve) => {
        const id = 'include-' + Date.now() + '-' + (++includeRequestSequence);
        const onResponse = (event: Event) => {
            const detail = (event as CustomEvent<{ id?: string; ok?: boolean; text?: string; debug?: string; headers?: string; token?: string }>).detail;
            if (detail?.id !== id) {
                return;
            }
            window.clearTimeout(timeout);
            window.removeEventListener(INCLUDE_RESPONSE_EVENT, onResponse);
            debug('GM 请求响应', { method, url: url.href, ok: detail.ok === true, length: detail.text?.length || 0, detail: detail.debug || '无额外信息' });
            resolve({ ok: detail.ok === true, text: detail.text || '', debug: detail.debug, headers: detail.headers || '', token: detail.token });
        };
        const timeout = window.setTimeout(() => {
            window.removeEventListener(INCLUDE_RESPONSE_EVENT, onResponse);
            debugError('GM 请求超时，未收到桥接响应', { method, url: url.href });
            resolve({ ok: false, text: '', debug: '主世界桥接响应超时' });
        }, SOURCE_TIMEOUT);
        window.addEventListener(INCLUDE_RESPONSE_EVENT, onResponse);
        window.dispatchEvent(new CustomEvent(INCLUDE_REQUEST_EVENT, { detail: { id, url: url.href, method, data } }));
    });
}

function extractPageId(html: string): string | null {
    return /WIKIREQUEST\.info\.pageId\s*=\s*(\d+)\s*;/.exec(html)?.[1]
        || /page_id=(\d+)/.exec(html)?.[1]
        || null;
}

function extractToken(html: string): string | null {
    return /name=["']wikidot_token7["'][^>]*value=["']([a-f0-9]+)["']/i.exec(html)?.[1]
        || /WIKIREQUEST\.wikidot_token7\s*=\s*["']([a-f0-9]+)["']/i.exec(html)?.[1]
        || null;
}

function extractTokenFromResponse(response: TextResponse): string | null {
    return response.token
        || extractToken(response.text)
        || /(?:^|[\r\n])set-cookie:\s*[^\r\n]*?\bwikidot_token7=([a-f0-9]+)/i.exec(response.headers || '')?.[1]
        || null;
}

async function fetchPageSource(target: IncludeTarget, pageHtml: string): Promise<string | null> {
    const pageId = extractPageId(pageHtml);
    let token = extractToken(pageHtml);
    if (!token) {
        // 页面正文通常没有 token。Wikidot 的 AMC 客户端同样会回退到站点首页，
        // 某些站点只会在那里输出可用于 ViewSourceModule 的 wikidot_token7。
        for (const path of ['/', '/_default']) {
            const tokenUrl = new URL(path, target.origin);
            const tokenPage = await fetchText(tokenUrl);
            token = tokenPage.ok ? extractTokenFromResponse(tokenPage) : null;
            info('尝试从站点页面提取 wikidot_token7', {
                origin: target.origin,
                path,
                requestOk: tokenPage.ok,
                tokenFound: Boolean(token),
                bridgeTokenReceived: Boolean(tokenPage.token),
                htmlLength: tokenPage.text.length,
            });
            if (token) break;
        }
    }
    if (!pageId || !token) {
        debugError('无法从页面 HTML 提取源码请求信息', {
            origin: target.origin,
            page: target.page,
            pageIdFound: Boolean(pageId),
            tokenFound: Boolean(token),
            htmlLength: pageHtml.length,
        });
        return null;
    }
    info('已提取源码请求信息', { origin: target.origin, page: target.page, pageId, tokenLength: token.length });
    const data = 'moduleName=viewsource%2FViewSourceModule&page_id=' + pageId + '&wikidot_token7=' + token;
    const url = new URL('/ajax-module-connector.php', target.origin);
    const response: TextResponse = target.remote
        ? await fetchCrossOriginText(url, 'POST', data)
        : await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: data, credentials: 'same-origin' })
            .then(async (result) => ({
                ok: result.ok,
                text: result.ok ? await result.text() : '',
                debug: 'HTTP ' + result.status,
            }));
    if (!response.ok) {
        debugError('ViewSourceModule 请求失败', { origin: target.origin, page: target.page, detail: response.debug || 'HTTP/GM 请求失败' });
        return null;
    }
    try {
        const result = JSON.parse(response.text) as { status?: string; body?: string };
        if (result.status !== 'ok' || typeof result.body !== 'string') {
            debugError('ViewSourceModule 返回非成功结果', { origin: target.origin, page: target.page, status: result.status || '缺失', hasBody: typeof result.body === 'string' });
            return null;
        }
        const source = /<div\s+class=["']page-source["'][^>]*>([\s\S]*?)<\/div>/i.exec(result.body)?.[1];
        if (!source) {
            debugError('ViewSourceModule 响应中未找到 page-source 容器', { origin: target.origin, page: target.page, bodyLength: result.body.length });
            return null;
        }
        const decoded = decodeHtml(source).trim();
        info('已获取被 include 页源码', { origin: target.origin, page: target.page, sourceLength: decoded.length });
        return decoded;
    } catch (error) {
        debugError('无法解析 ViewSourceModule 响应 JSON', { origin: target.origin, page: target.page, error: String(error), responseLength: response.text.length });
        return null;
    }
}

function extractParameterReferences(source: string): Set<string> {
    const names = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = PARAMETER_REFERENCE_PATTERN.exec(source))) names.add(match[1]);
    return names;
}

async function validatePage(include: string): Promise<PageValidationResult> {
    const target = parseIncludeTarget(include);
    if (!target) {
        debugError('include 目标格式无效，无法解析', { include });
        return { exists: null, usedParameters: null };
    }

    const cacheKey = target.origin + '/' + target.page;
    const cached = pageValidationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        info('命中 include 页面源码缓存', { include, expiresInSeconds: Math.ceil((cached.expiresAt - Date.now()) / 1000) });
        return cached.result;
    }
    if (cached) pageValidationCache.delete(cacheKey);

    const pending = pendingPageValidations.get(cacheKey);
    if (pending) {
        info('复用进行中的 include 页面请求', { include });
        return pending;
    }

    const validation = fetchPageValidation(target, include);
    pendingPageValidations.set(cacheKey, validation);
    try {
        const result = await validation;
        // 仅缓存已成功读取到源码的页面；网络或权限问题需要在下次校验时重试。
        if (result.exists === true && result.usedParameters !== null) {
            pageValidationCache.set(cacheKey, { expiresAt: Date.now() + PAGE_VALIDATION_CACHE_TTL, result });
            info('已缓存 include 页面源码校验结果', { include, ttlSeconds: PAGE_VALIDATION_CACHE_TTL / 1000 });
        }
        return result;
    } finally {
        pendingPageValidations.delete(cacheKey);
    }
}

async function fetchPageValidation(target: IncludeTarget, include: string): Promise<PageValidationResult> {
    try {
        const page = await fetchText(new URL('/' + target.page, target.origin));
        if (!page.ok) {
            debugError('被 include 页面不存在或无法访问', { include, origin: target.origin, page: target.page, detail: page.debug || 'HTTP 请求失败' });
            return { exists: false, usedParameters: null };
        }
        const source = await fetchPageSource(target, page.text);
        const usedParameters = source === null ? null : extractParameterReferences(source);
        info('include 页面校验完成', { include, sourceRead: source !== null, usedParameters: usedParameters ? [...usedParameters] : null });
        return { exists: true, usedParameters };
    } catch (error) {
        debugError('include 页面校验出现异常', { include, error: String(error) });
        return { exists: null, usedParameters: null };
    }
}

function toMarker(monaco: any, model: any, issue: IncludeValidationIssue): any {
    const start = model.getPositionAt(issue.start);
    const end = model.getPositionAt(issue.end);
    const severityName = issue.severity[0].toUpperCase() + issue.severity.slice(1);
    return { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column, message: issue.message, severity: monaco.MarkerSeverity[severityName] };
}

export async function validateIncludes(monaco: any, model: any): Promise<void> {
    const directives = parseIncludeDirectives(model.getValue());
    info('开始 include 校验', { directives: directives.map((directive) => ({ page: directive.page, parameters: directive.parameters.map((parameter) => parameter.name), syntaxErrors: directive.errors.length })) });
    const results = new Map<string, PageValidationResult>();
    await Promise.all([...new Set(directives.map((directive) => directive.page))].map(async (page) => results.set(page, await validatePage(page))));

    const issues: IncludeValidationIssue[] = [];
    for (const directive of directives) {
        issues.push(...directive.errors);
        const result = results.get(directive.page);
        if (!result) continue;
        if (result.exists === false) {
            issues.push({ start: directive.pageStart, end: directive.pageEnd, message: '被 include 的页面 "' + directive.page + '" 不存在或不可访问。', severity: 'error' });
            continue;
        }
        const target = parseIncludeTarget(directive.page);
        if (result.exists === null) {
            issues.push({ start: directive.pageStart, end: directive.pageEnd, message: target?.remote ? '无法读取跨站 include 页面，已仅完成调用语法检查。' : '无法读取被 include 页，已仅完成调用语法检查。', severity: 'info' });
            continue;
        }
        if (!result.usedParameters) {
            issues.push({
                start: directive.pageStart,
                end: directive.pageEnd,
                message: '无法读取被 include 页的源码，未能检查模板参数是否实际使用。',
                severity: 'info',
            });
            continue;
        }
        const passed = new Set(directive.parameters.map((parameter) => parameter.name));
        for (const parameter of directive.parameters) {
            if (!result.usedParameters.has(parameter.name)) issues.push({ start: parameter.start, end: parameter.end, message: '参数 "' + parameter.name + '" 未在被 include 页中使用。', severity: 'warning' });
        }
        for (const name of result.usedParameters) {
            if (!passed.has(name)) issues.push({ start: directive.pageStart, end: directive.pageEnd, message: '被 include 页使用参数 "' + name + '"，但当前未传入。', severity: 'warning' });
        }
    }
    monaco.editor.setModelMarkers(model, 'wikidot-include-validator', issues.map((issue) => toMarker(monaco, model, issue)));
    info('include 校验结束', { issueCount: issues.length, issues: issues.map((issue) => issue.message) });
}
