<p align="center">
  <img src="./assets/logo.svg" width="160" alt="Wikidot Editor Better logo">
</p>

<h1 align="center">Wikidot Editor Better</h1>

<p align="center">
  为 Wikidot 编辑页带来 Monaco Editor 体验的 Tampermonkey 用户脚本。
</p>

<p align="center">
  <a href="https://github.com/SuperUseryjh/wikidot-editor-better/releases"><img src="https://img.shields.io/github/v/release/SuperUseryjh/wikidot-editor-better?display_name=tag&sort=semver&label=%E5%8F%91%E5%B8%83" alt="发布版本"></a>
  <a href="https://github.com/SuperUseryjh/wikidot-editor-better/stargazers"><img src="https://img.shields.io/github/stars/SuperUseryjh/wikidot-editor-better?style=flat&label=Stars" alt="GitHub Stars"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-GPL%20v3.0-2dc8d8" alt="GPL v3.0"></a>
  <a href="https://github.com/SuperUseryjh/wikidot-editor-better/actions"><img src="https://img.shields.io/github/actions/workflow/status/SuperUseryjh/wikidot-editor-better/release.yml?label=%E6%9E%84%E5%BB%BA" alt="构建状态"></a>
</p>

将 [Wikidot](https://www.wikidot.com/) 页面源代码编辑区域的 `textarea` 替换为 [Monaco Editor](https://microsoft.github.io/monaco-editor/)（VS Code 同款编辑器）的 Tampermonkey 油猴脚本。原工具栏按钮、快捷键、表单提交全部保持可用。

将 [Wikidot](https://www.wikidot.com/) 页面源代码编辑区域的 `textarea` 替换为 [Monaco Editor](https://microsoft.github.io/monaco-editor/)（VS Code 同款编辑器）的 Tampermonkey 油猴脚本。原工具栏按钮、快捷键、表单提交全部保持可用。

此项目又名 FuckiDot Editor。

## 安装入口

- [安装稳定版脚本](https://static.yaoonion.fun/wikidot-editor-better/pub/wikidot-editor-better.user.js)
- [查看 GitHub Releases](https://github.com/SuperUseryjh/wikidot-editor-better/releases)
- [报告问题或提出建议](https://github.com/SuperUseryjh/wikidot-editor-better/issues)

## 功能特性

- **Monaco 编辑器接管编辑区**：语法高亮、代码折叠、括号配对、光标位置状态栏、暗色主题适配
- **Wikidot 源码语法高亮**：
  - `[[collapsible]]`、`[[module]]`、`[[/...]]` 等双中括号模块
  - `[[module CSS]] ... [[/module]]` 内部按 CSS 语法解析
  - `[[html]] ... [[/html]]` 内部按 HTML 语法解析
  - HTML 内部的内联 `<script>` / `<style>` 内容分别嵌入 JavaScript / CSS 高亮
  - 标题、列表、引用、表格、`++` 标题、`{{{ 代码 }}}` 等 Wikidot 标记
- **快捷键与工具栏联动**：`Ctrl/Cmd+B` 加粗、`Ctrl/Cmd+I` 斜体、`Ctrl/Cmd+U` 下划线，复用原页面工具栏按钮逻辑
- **列表续行**：行首以 `*` `#` `:` 开头时按回车自动延续
- **字号调节**：沿用页面"字号 +/-"按钮，设置保存在 `localStorage`
- **编辑区属性代理**：`value` / `selectionStart` / `selectionEnd` / `focus` / `setSelectionRange` 全部桥接到 Monaco，保证 Wikidot 原有的保存、预览、草稿、表单校验逻辑不受影响
- **多 CDN 加速加载**：4 个 AMD CDN 并行竞速，任一成功即用，失败自动逐级兜底（AMD → ESM）
- **自动更新检查**：定期拉取静态站点 `version.json` 对比版本，有新版本时通过系统通知（`GM_notification`）提示，点击即可在新标签页安装

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展
2. 安装本脚本（任选其一）：
   - 从 GitHub [Releases](https://github.com/SuperUseryjh/wikidot-editor-better/releases) 下载 `wikidot-editor-better.user.js`
   - 或直接访问标准版安装地址：`https://static.yaoonion.fun/wikidot-editor-better/pub/wikidot-editor-better.user.js`
3. 打开任意 Wikidot 页面，点击"编辑"按钮即可看到 Monaco 编辑器接管编辑区

## 开发与构建

```bash
npm install
npm run build
```

构建产物输出到 `dist/wikidot-editor-better.user.js`，可直接在 Tampermonkey 中"从文件导入"调试。

| 命令 | 说明 |
| --- | --- |
| `npm run build` | `tsc` 编译 → `bundle.js` 打包 bootstrap → 组合油猴脚本 |
| `npm run dev` | `tsc --watch` 增量编译 |

## 项目结构

```
src/
├── main.ts            # 注入器（Tampermonkey 上下文）：注入 bootstrap + 更新检查
├── bootstrapMain.ts   # 引导脚本：加载 Monaco、监听编辑区出现并接管
├── monacoLoader.ts    # Monaco 多 CDN 加载策略（AMD 并行 + ESM 兜底）
├── editor.ts          # Monaco 编辑器集成：textarea 属性代理、快捷键、字号等
├── wikidotLanguage.ts # Wikidot Monarch 语法定义（含 CSS/HTML 模块、内联 script/style 嵌入）
├── checkUpdate.ts     # 自动更新检查（GM_xmlhttpRequest + GM_notification）
├── constants.ts       # 常量（CDN、编辑区选择器、更新检查地址等）
├── types.ts           # 全局类型声明（Monaco、Tampermonkey API）
└── utils.ts           # 工具函数
scripts/
├── bundle.ts               # esbuild 打包 bootstrap / 注入器
├── generate-icon.ts         # SVG logo 转 PNG Data URL
└── generate-userscript.ts  # 拼接油猴元数据 + 产物
.github/workflows/release.yml # 自动构建、发布 Release、推送静态仓库
```

## 发布与自动更新

项目参考 https://github.com/SuperUseryjh/sample-fetch 项目的发布流程，通过 GitHub Actions 自动化：

- push 到任意分支触发构建；`main` 分支还会：
  1. 用 `gh release create` 创建 GitHub Release（含脚本资产），预发布版本自动标记 `prerelease`；正文固定读取 `RELEASE_NOTES.md`
  2. 把脚本与 `package.json`（作为 `version.json`）推送到静态仓库 `SuperUseryjh/static` 的 `wikidot-editor-better/pub`（标准版本号）或 `wikidot-editor-better/perv`（预发布版本号）目录
  3. 静态站点 `static.yaoonion.fun` 托管上述文件，脚本端定期拉取 `version.json` 对比并提示更新
- 非 `main` 分支仅上传构建产物为 Artifact
- 发版时请与 `package.json` 的版本号一并更新 `RELEASE_NOTES.md`

### 仓库 Secret 配置

在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 |
| --- | --- |
| `STATIC_REPO_TOKEN` | 推送 static 仓库所需的 Personal Access Token（需对 `SuperUseryjh/static` 有写权限） |

### 更新检查频率

- 标准版本号（`x.y.z`）：每 24 小时检查一次
- 预发布版本号（如 `1.0.0-alpha1`）：每 1 小时检查一次

## License

GNU GPL v3.0

## Star History

<a href="https://www.star-history.com/?repos=SuperUseryjh%2Fwikidot-editor-better&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=SuperUseryjh/wikidot-editor-better&type=date&theme=dark&legend=top-left&sealed_token=jSUJ2OjztYQyZ4c84I4pb8eGAdQ889KPESwQVMqcVRhF07C2SCi1CspaZOCzHgoTj9fC66thdej58mQpRvdb6xpg6e-Y5rXReUToeB99oTwMBa1veWJ_0TMycOtw2EseMLWfHdUPA5_N0u5eI81uQHBbcoLLUGWKWqxESFZFXQiYQBGMUnroW64Vprni" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=SuperUseryjh/wikidot-editor-better&type=date&legend=top-left&sealed_token=jSUJ2OjztYQyZ4c84I4pb8eGAdQ889KPESwQVMqcVRhF07C2SCi1CspaZOCzHgoTj9fC66thdej58mQpRvdb6xpg6e-Y5rXReUToeB99oTwMBa1veWJ_0TMycOtw2EseMLWfHdUPA5_N0u5eI81uQHBbcoLLUGWKWqxESFZFXQiYQBGMUnroW64Vprni" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=SuperUseryjh/wikidot-editor-better&type=date&legend=top-left&sealed_token=jSUJ2OjztYQyZ4c84I4pb8eGAdQ889KPESwQVMqcVRhF07C2SCi1CspaZOCzHgoTj9fC66thdej58mQpRvdb6xpg6e-Y5rXReUToeB99oTwMBa1veWJ_0TMycOtw2EseMLWfHdUPA5_N0u5eI81uQHBbcoLLUGWKWqxESFZFXQiYQBGMUnroW64Vprni" />
 </picture>
</a>
