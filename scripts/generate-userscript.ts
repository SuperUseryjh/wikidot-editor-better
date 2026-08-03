import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface UserscriptMetadata {
    name: string;
    namespace: string;
    description: string;
    author: string;
    match?: string[];
    require?: string[];
    grant?: string[];
    connect?: string[];
    'run-at'?: string;
    'inject-into'?: string;
}

interface PackageJson {
    version: string;
    userscript: UserscriptMetadata;
}

const root = resolve(import.meta.dir, '..');
const packageJson = await Bun.file(resolve(root, 'package.json')).json() as PackageJson;
const { userscript: metadata, version } = packageJson;
const outputFile = resolve(root, 'dist/wikidot-editor-better.user.js');
const bundledJsFile = resolve(root, 'dist/bundle.js');

let metadataBlock = '// ==UserScript==\n';
metadataBlock += `// @name         ${metadata.name}\n`;
metadataBlock += `// @namespace    ${metadata.namespace}\n`;
metadataBlock += `// @version      ${version}\n`;
metadataBlock += `// @description  ${metadata.description}\n`;
metadataBlock += `// @author       ${metadata.author}\n`;

if (metadata['run-at']) metadataBlock += `// @run-at      ${metadata['run-at']}\n`;
if (metadata['inject-into']) metadataBlock += `// @inject-into ${metadata['inject-into']}\n`;
for (const item of metadata.match || []) metadataBlock += `// @match        ${item}\n`;
for (const item of metadata.require || []) metadataBlock += `// @require      ${item}\n`;
for (const item of metadata.grant || []) metadataBlock += `// @grant        ${item}\n`;
for (const item of metadata.connect || []) metadataBlock += `// @connect      ${item}\n`;
metadataBlock += '// ==/UserScript==\n';

writeFileSync(outputFile, metadataBlock + readFileSync(bundledJsFile, 'utf8'));
console.log('Tampermonkey script generated successfully!');
