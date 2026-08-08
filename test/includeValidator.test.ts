import { describe, expect, test } from 'bun:test';
import { parseIncludeDirectives, parseIncludeTarget } from '../src/includeValidator';

describe('parseIncludeDirectives', () => {
    test('parses a valid include and its named parameters', () => {
        const [include] = parseIncludeDirectives('[[include template/card title=Hello count=2]]');

        expect(include.page).toBe('template/card');
        expect(include.parameters.map((parameter) => [parameter.name, parameter.value])).toEqual([
            ['title', 'Hello'],
            ['count', '2'],
        ]);
        expect(include.errors).toEqual([]);
    });

    test('reports malformed, invalid, and duplicated parameters', () => {
        const [include] = parseIncludeDirectives('[[include template/card title=Hello title=Again 3bad=value malformed]]');

        expect(include.errors.map((error) => error.message)).toEqual([
            '参数 "title" 重复传入。',
            '参数名 "3bad" 无效。',
            'include 参数必须使用 name=value 形式。',
        ]);
    });

    test('treats pipe-prefixed parameters as continuation separators', () => {
        const [include] = parseIncludeDirectives('[[include template/card\n|title=Hello\n|count=2]]');

        expect(include.parameters.map((parameter) => [parameter.name, parameter.value])).toEqual([
            ['title', 'Hello'],
            ['count', '2'],
        ]);
        expect(include.errors).toEqual([]);
    });

    test('accepts Unicode parameter names', () => {
        const [include] = parseIncludeDirectives('[[include template/card 变量名=数值]]');

        expect(include.parameters.map((parameter) => [parameter.name, parameter.value])).toEqual([
            ['变量名', '数值'],
        ]);
        expect(include.errors).toEqual([]);
    });

    test('resolves current-site and cross-site Wikidot include targets', () => {
        expect(parseIncludeTarget(':shared-template', 'https://example.wikidot.com')).toEqual({
            page: 'shared-template',
            origin: 'https://example.wikidot.com',
            remote: false,
        });
        expect(parseIncludeTarget(':scp-wiki:shared-template', 'https://example.wikidot.com')).toEqual({
            page: 'shared-template',
            origin: 'https://scp-wiki.wikidot.com',
            remote: true,
        });
        expect(parseIncludeTarget('maa-sandbox:open:uo-010', 'https://example.wikidot.com')).toEqual({
            page: 'open:uo-010',
            origin: 'https://maa-sandbox.wikidot.com',
            remote: true,
        });
        expect(parseIncludeTarget(':maa-sandbox:open:uo-010', 'https://example.wikidot.com')).toEqual({
            page: 'open:uo-010',
            origin: 'https://maa-sandbox.wikidot.com',
            remote: true,
        });
        expect(parseIncludeTarget(':', 'https://example.wikidot.com')).toBeNull();
    });

    test('keeps page-name colons in the cross-site source target', () => {
        const target = parseIncludeTarget('maa-sandbox:open:uo-010', 'https://example.wikidot.com');
        expect(target?.origin + '/edit:true/page:' + encodeURIComponent(target.page).replace(/%3A/gi, ':')).toBe(
            'https://maa-sandbox.wikidot.com/edit:true/page:open:uo-010'
        );
    });
});
