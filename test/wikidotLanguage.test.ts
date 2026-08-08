import { describe, expect, test } from 'bun:test';
import { parseWikidotBlockSymbols } from '../src/wikidotLanguage';

describe('parseWikidotBlockSymbols', () => {
    test('recognizes html blocks and nested Wikidot blocks', () => {
        const source = '[[html]]\n<main>\n<section class="card">content<br></section>\n</main>\n[[div_ class="note"]]\ninside\n[[/div]]\n[[/html]]';
        const symbols = parseWikidotBlockSymbols(source);

        expect(symbols).toHaveLength(1);
        expect(symbols[0]).toMatchObject({ name: '[[html]]', startLine: 1, endLine: 8 });
        expect(symbols[0].children).toMatchObject([
            { name: '<main>', startLine: 2, endLine: 4, children: [{ name: '<section class="card">', startLine: 3, endLine: 3 }] },
            { name: '[[div_ class="note"]]', startLine: 5, endLine: 7 },
        ]);
    });

    test('does not make unclosed single-line directives sticky', () => {
        expect(parseWikidotBlockSymbols('[[include component:card title=Hello]]')).toEqual([]);
    });

    test('matches module tags with their generic closing tag', () => {
        const [symbol] = parseWikidotBlockSymbols('[[module CSS]]\n.example {}\n[[/module]]');

        expect(symbol).toMatchObject({ name: '[[module CSS]]', startLine: 1, endLine: 3 });
    });
});
