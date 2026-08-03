const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const metadata = packageJson.userscript;
const version = packageJson.version;
const outputFile = path.resolve(__dirname, '../dist/wikidot-editor-better.user.js');
const bundledJsFile = path.resolve(__dirname, '../dist/bundle.js');

let metadataBlock = '// ==UserScript==\n';
metadataBlock += `// @name         ${metadata.name}\n`;
metadataBlock += `// @namespace    ${metadata.namespace}\n`;
metadataBlock += `// @version      ${version}\n`;
metadataBlock += `// @description  ${metadata.description}\n`;
metadataBlock += `// @author       ${metadata.author}\n`;

if (metadata['run-at']) {
    metadataBlock += `// @run-at      ${metadata['run-at']}\n`;
}

if (metadata['inject-into']) {
    metadataBlock += `// @inject-into ${metadata['inject-into']}\n`;
}

if (metadata.match && Array.isArray(metadata.match)) {
    metadata.match.forEach(item => {
        metadataBlock += `// @match        ${item}\n`;
    });
}

if (metadata.require && Array.isArray(metadata.require)) {
    metadata.require.forEach(item => {
        metadataBlock += `// @require      ${item}\n`;
    });
}

if (metadata.grant && Array.isArray(metadata.grant)) {
    metadata.grant.forEach(item => {
        metadataBlock += `// @grant        ${item}\n`;
    });
}

if (metadata.connect && Array.isArray(metadata.connect)) {
    metadata.connect.forEach(item => {
        metadataBlock += `// @connect      ${item}\n`;
    });
}

metadataBlock += '// ==/UserScript==\n';

const bundledJsContent = fs.readFileSync(bundledJsFile, 'utf8');

fs.writeFileSync(outputFile, metadataBlock + bundledJsContent);

console.log('Tampermonkey script generated successfully!');
