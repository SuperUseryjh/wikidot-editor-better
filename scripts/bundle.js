const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

/**
 * 构建流程：
 * 1. 将 src/bootstrapMain.ts（主世界引导）打包为自包含 IIFE 字符串；
 * 2. 写入 dist/generated/bootstrapCode.js（覆盖 tsc 的占位产物），
 *    使 main.js 通过 import 拿到真实的 bootstrap 代码；
 * 3. 将 src/main.ts（注入器）打包为最终的 userscript bundle。
 */
async function main() {
  const root = path.resolve(__dirname, '..');

  // 1. 打包主世界引导脚本
  const bootstrapResult = await esbuild.build({
    entryPoints: [path.resolve(root, 'dist/bootstrapMain.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
  });
  const bootstrapCode = bootstrapResult.outputFiles[0].text;

  // 2. 覆盖 bootstrapCode.js 占位产物
  const bootstrapCodePath = path.resolve(root, 'dist/generated/bootstrapCode.js');
  fs.mkdirSync(path.dirname(bootstrapCodePath), { recursive: true });
  fs.writeFileSync(
    bootstrapCodePath,
    `export const BOOTSTRAP_CODE = ${JSON.stringify(bootstrapCode)};\n`
  );

  // 3. 打包注入器
  await esbuild.build({
    entryPoints: [path.resolve(root, 'dist/main.js')],
    bundle: true,
    outfile: path.resolve(root, 'dist/bundle.js'),
    format: 'iife', // 油猴脚本以经典脚本方式执行，使用 IIFE 格式
    platform: 'browser',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
