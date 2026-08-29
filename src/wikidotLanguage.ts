import { WIKIDOT_LANGUAGE_ID } from './constants';

export interface WikidotBlockSymbol {
    name: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    children: WikidotBlockSymbol[];
}

interface OpenBlock extends WikidotBlockSymbol {
    normalizedName: string;
}

const HTML_VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function normalizeBlockName(name: string): string {
    return name.replace(/_+$/, '').toLowerCase();
}

/**
 * 找出成对 Wikidot 块标签，以及 [[html]] 内的成对 HTML 标签，供 Monaco
 * Sticky Scroll 使用。未闭合或不匹配的标签不会成为符号，避免 include 等
 * 单行指令误入驻留栏。
 */
export function parseWikidotBlockSymbols(source: string): WikidotBlockSymbol[] {
    const roots: WikidotBlockSymbol[] = [];
    const stack: OpenBlock[] = [];
    let htmlDepth = 0;
    const lines = source.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const tagPattern = /\[\[\s*(\/)?\s*([A-Za-z][\w-]*_?)(?:\s[^\]]*)?\]\]|<\s*(\/)?\s*([A-Za-z][\w-]*)(?:\s[^<>]*?)?(\/?)\s*>/g;
        let match: RegExpExecArray | null;
        while ((match = tagPattern.exec(line))) {
            const isWikidotTag = Boolean(match[2]);
            const isInsideHtml = htmlDepth > 0;
            if (!isWikidotTag && !isInsideHtml) continue;

            const isClosing = Boolean(isWikidotTag ? match[1] : match[3]);
            const rawName = isWikidotTag ? match[2] : match[4];
            const normalizedName = (isWikidotTag ? 'wiki:' : 'html:') + normalizeBlockName(rawName);
            const isSelfClosing = !isWikidotTag && (Boolean(match[5]) || HTML_VOID_ELEMENTS.has(rawName.toLowerCase()));
            const startColumn = match.index + 1;
            const endColumn = match.index + match[0].length + 1;

            if (!isClosing && !isSelfClosing) {
                stack.push({
                    name: match[0],
                    normalizedName,
                    startLine: lineIndex + 1,
                    startColumn,
                    endLine: lineIndex + 1,
                    endColumn,
                    children: [],
                });
                if (normalizedName === 'wiki:html') htmlDepth++;
                continue;
            }

            if (!isClosing) continue;
            const openIndex = stack.map((block) => block.normalizedName).lastIndexOf(normalizedName);
            if (openIndex === -1) continue;

            const [open] = stack.splice(openIndex, 1);
            if (normalizedName === 'wiki:html') htmlDepth--;
            open.endLine = lineIndex + 1;
            open.endColumn = endColumn;
            delete (open as Partial<OpenBlock>).normalizedName;
            const parent = stack[stack.length - 1];
            if (parent) parent.children.push(open);
            else roots.push(open);
        }
    }

    return roots;
}

/**
 * Wikidot 语法的基础高亮（Monarch tokenizer）
 * 覆盖：标题 +/++/+++、粗体、斜体、删除线、下划线、[[...]] 模块、|| 表格、> 引用、@@ 原始文本等。
 */
export function registerWikidotLanguage(monaco: any): void {
    monaco.languages.register({ id: WIKIDOT_LANGUAGE_ID });

    monaco.languages.setMonarchTokensProvider(WIKIDOT_LANGUAGE_ID, {
        ignoreCase: false,
        comments: [{ line: '//' }],
        brackets: [
            { open: '[[', close: ']]', token: 'delimiter.bracket' },
        ],
        tokenizer: {
            root: [
                // 注释（模块内）
                [/^\s*\/\/.*$/, 'comment'],
                // CSS 模块 [[module CSS]]...[[/module]]：进入 CSS 高亮状态
                // 注意：Monarch 编译会丢弃正则字面量的 flags（/i 无效），模块名用字符类显式写大小写
                [/\[\[module\s+[cC][sS][sS]\s*\]\]/, { token: 'tag', next: '@css' }],
                // html 模块 [[html]]...[[/html]]：进入 HTML 高亮状态
                [/\[\[[hH][tT][mM][lL]\s*\]\]/, { token: 'tag', next: '@html' }],
                // 通用 module 标签 [[module Name attr="value" ...]]：
                // 进入 moduleTag 状态，分别高亮模块名与属性（CSS 模块已在上方单独处理）
                [/\[\[module(?=[\s])/, { token: 'tag', next: '@moduleTag' }],
                // 标题 + ++ +++（无捕获组，避免 Monarch "groups 不匹配" 报错）
                [/^\s*\+{1,6}\s/, 'keyword.heading'],
                // 水平线
                [/^-{4,}$/, 'keyword.hr'],
                // 表格行
                [/^\s*\|+/, 'keyword.table'],
                [/\|\|/, 'keyword.table'],
                // 引用
                [/^\s*>+\s/, 'keyword.quote'],
                // [[...]] 模块：打开 [[name]] 或闭合 [[/name]]，可带参数，完整匹配一对 ]]。
                // (?!\[) 排除 [[[ 链接（交给下方 string.link）；[^\]]* 与 ] 互斥，
                // 回溯是线性的，不会灾难回溯，且不会跨行。
                [/\[\[(?!\[)[^\]]*\]\]/, 'tag'],
                // 原始文本 @@ ... @@
                [/@@/, 'keyword.raw'],
                // 粗体/斜体：直接简单匹配。
                // 注意：不能用带配对前瞻的写法（如 (\*\*)(?=(?:[^*]|(?!\1).)*\*\*)），
                // 那是嵌套量词+重叠交替，对无配对标记的长行会产生灾难性回溯，
                // 导致 Monaco 主线程 tokenize 卡死整页。
                [/\*\*/, 'keyword.bold'],
                [/(?<!\*)\*\*(?!\*)/, 'keyword.bold'],
                // 斜体 //（行首 // 注释已在上方规则覆盖，这里匹配行中 //，避开 ///）
                [/\/\/(?!\/)/, 'keyword.italic'],
                // 删除线
                [/\-\-/, 'keyword.strike'],
                // 下划线
                [/__/, 'keyword.underline'],
                // 行内代码 {{{ }}}
                [/\{\{\{/, 'keyword.code'],
                [/\}\}\}/, 'keyword.code'],
                // 链接 [http:// ... ] / [[[...]]]
                [/\[https?:\/\/[^\s]+/, 'string.link'],
                [/\[\[\[/, 'string.link'],
                [/\]\]\]/, 'string.link'],
                // 数字
                [/\d+/, 'number'],
            ],
            // CSS 模块内部：[[module CSS]] ... [[/module]]
            // 注意：Monarch 编译要求状态必须是纯数组（对象形式会抛 "not iterable"）
            css: [
                // 关闭标签：退出 CSS 状态（关键字大小写不敏感）
                [/\[\[\/[mM][oO][dD][uU][lL][eE]\s*\]\]/, { token: 'tag', next: '@pop' }],
                // 注释（可跨行）
                [/\/\*/, 'comment', '@cssComment'],
                // 十六进制颜色
                [/#[0-9a-fA-F]{3,8}\b/, 'number.hex'],
                // 类 / ID 选择器
                [/[.#][a-zA-Z][\w-]*/, 'tag'],
                // 元素选择器（后面跟 { 或 ,）
                [/[a-zA-Z][\w-]*(?=\s*[,{])/, 'type'],
                // 伪类 / 伪元素
                [/::?[\w-]+/, 'keyword'],
                // @media / @import 等（@@ 是 Monarch 的字面 @ 转义，否则 @ 会被当属性引用展开）
                [/@@[\w-]+/, 'keyword.atrule'],
                // 花括号
                [/\{/, 'delimiter.bracket'],
                [/\}/, 'delimiter.bracket'],
                // 属性名（后面跟 :）
                [/[a-zA-Z-]+(?=\s*:)/, 'attribute.name'],
                [/:/, 'delimiter'],
                [/;/, 'delimiter'],
                // 数字 + 单位
                [/\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|pt|ex|ch)?\b/, 'number'],
                // 字符串
                [/"[^"]*"|'[^']*'/, 'string'],
                // 值关键字
                [/\b[a-zA-Z][\w-]*\b/, 'attribute.value'],
            ],
            // 通用 module 标签内部：模块名 + 属性
            moduleTag: [
                // 结束 ]]：回到根状态
                [/\]\]/, { token: 'tag', next: '@pop' }],
                // 属性名（后面跟 =；支持 _data-form-field-name 这类下划线开头）
                [/[A-Za-z_][\w-]*(?=\s*=)/, 'attribute.name'],
                // = 后进入 moduleValue 读取属性值（引号或裸值）
                [/=/, { token: 'delimiter', next: '@moduleValue' }],
                // 模块名（第一个词）
                [/[A-Za-z][\w-]*/, 'type'],
            ],
            // module 属性值：引号字符串或裸值，读取后回到 moduleTag
            moduleValue: [
                [/"[^"]*"|'[^']*'/, { token: 'string', next: '@pop' }],
                [/[^\s\]]+/, { token: 'attribute.value', next: '@pop' }],
            ],
            cssComment: [
                [/\*\//, 'comment', '@pop'],
                [/[^/*]+/, 'comment'],
                [/[/*]/, 'comment'],
            ],
            // HTML 模块内部：[[html]] ... [[/html]]
            html: [
                // 关闭标签：退出 HTML 状态（标签名大小写不敏感）
                [/\[\[\/[hH][tT][mM][lL]\s*\]\]/, { token: 'tag', next: '@pop' }],
                // 注释（可跨行）
                [/<!--/, 'comment', '@htmlComment'],
                // DOCTYPE
                [/<!d[oO][cC][tT][yY][pP][eE][^>]*>/, 'keyword'],
                // 内联 <script>：进入 script 状态并嵌入 javascript 语言（必须先于通用标签规则）
                [/<script(?=[\s>])[^>]*>/, { token: 'tag', next: '@script', nextEmbedded: 'javascript' }],
                // 内联 <style>：进入 style 状态并嵌入 css 语言（必须先于通用标签规则）
                [/<style(?=[\s>])[^>]*>/, { token: 'tag', next: '@style', nextEmbedded: 'css' }],
                // 开始 / 结束标签名
                [/<\/?[a-zA-Z][\w-]*/, 'tag'],
                // 标签闭合 > 或 />
                [/\/?>/, 'tag'],
                // 属性名（后面跟 =）
                [/[a-zA-Z-]+(?=\s*=)/, 'attribute.name'],
                [/=/, 'delimiter'],
                // 属性值
                [/"[^"]*"|'[^']*'/, 'string'],
                // 字符实体
                [/&[a-zA-Z#0-9]{2,8};/, 'constant.character.entity'],
                // 数字
                [/\d+/, 'number'],
            ],
            htmlComment: [
                [/-->/, 'comment', '@pop'],
                [/[^<-]+/, 'comment'],
                [/[<-]/, 'comment'],
            ],
            // 内联 <script> 内容：由 javascript 语言 tokenize，
            // 此状态只需提供带 nextEmbedded:"@pop" 的退出规则（Monarch 用它定位退出位置）
            script: [
                [/<\/script\s*>/, { token: 'tag', next: '@pop', nextEmbedded: '@pop' }],
            ],
            // 内联 <style> 内容：由 css 语言 tokenize
            style: [
                [/<\/style\s*>/, { token: 'tag', next: '@pop', nextEmbedded: '@pop' }],
            ],
        },
    } as any);

    // 高亮规则：让 [[...]] 等标签显示更醒目
    monaco.languages.setLanguageConfiguration(WIKIDOT_LANGUAGE_ID, {
        comments: { lineComment: '//' },
        brackets: [['[[', ']]']],
        autoClosingPairs: [
            { open: '[[', close: ']]' },
            { open: '{{{', close: '}}}' },
            { open: '**', close: '**' },
            { open: '//', close: '//' },
            { open: "'", close: "'" },
            { open: '(', close: ')' },
        ],
        surroundingPairs: [
            { open: '[[', close: ']]' },
            { open: '{{{', close: '}}}' },
            { open: '**', close: '**' },
            { open: '//', close: '//' },
            { open: "'", close: "'" },
            { open: '(', close: ')' },
        ],
    } as any);

    monaco.languages.registerDocumentSymbolProvider(WIKIDOT_LANGUAGE_ID, {
        provideDocumentSymbols(model: any) {
            const toSymbol = (block: WikidotBlockSymbol): any => ({
                name: block.name,
                detail: 'Wikidot 块标签',
                kind: monaco.languages.SymbolKind.Namespace,
                range: {
                    startLineNumber: block.startLine,
                    startColumn: block.startColumn,
                    endLineNumber: block.endLine,
                    endColumn: block.endColumn,
                },
                selectionRange: {
                    startLineNumber: block.startLine,
                    startColumn: block.startColumn,
                    endLineNumber: block.startLine,
                    endColumn: block.startColumn + block.name.length,
                },
                children: block.children.map(toSymbol),
            });
            return parseWikidotBlockSymbols(model.getValue()).map(toSymbol);
        },
    });
}
