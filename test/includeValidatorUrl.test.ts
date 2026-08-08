import { describe, expect, test } from 'bun:test';

describe('include source URL encoding', () => {
    test('preserves Wikidot page-name colons while encoding other characters', () => {
        expect(encodeURIComponent('component:coclass').replace(/%3A/gi, ':')).toBe('component:coclass');
        expect(encodeURIComponent('open:uo 010').replace(/%3A/gi, ':')).toBe('open:uo%20010');
    });
});
