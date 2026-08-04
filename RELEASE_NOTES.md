# Release Notes

你好，这里是 Wikidot Editor Better / FuckiDot Editor 的 version 1.0.2-beta1 发布说明。

## 编辑页体验

- Feat: 新增完整编辑页覆写：工具栏、编辑器容器、状态栏、表单、锁定提示与操作按钮统一为现代化明暗主题界面。
- Feat: 工具栏改用 Lucide 图标库，并以 CSS mask 方式渲染，适配 Wikidot 异步插入的工具项与标题子菜单。
- Feat: 底部操作按钮使用图标代理按钮；点击后显示“加载中…”，避免重复提交或重复请求。
- Feat: 新增“显示变更”结果的 VS Code 风格 diff 外观，分别突出整行与行内新增/删除内容，并支持深色模式。
- Feat: 为 Wikidot hovertip 增加统一的明暗主题外观与正确的层叠优先级。

## 配置与兼容性

- Feat: 新增油猴菜单设置页，配置通过 GM 存储在所有匹配网站间共享。
- Feat: 可单独关闭完整编辑页覆写；关闭后仍由 Monaco Editor 替换原生 textarea，同时保留 Wikidot 原生页面版式、工具栏和按钮。
- Fix: 设置保存兼容同步及 Promise 形式的 GM 存储 API。
- Fix: 工具栏插入内容改为进入 Monaco 撤销栈，支持通过 Ctrl+Z 撤销。
- Fix: 修复列表行按 Enter 自动延续时的编辑器报错。

## 加载与稳定性

- Feat: 首选 CDN 加载缓慢并进入备用源时，显示可关闭的自定义提示弹窗；Monaco 成功加载后自动关闭。
- Refactor: 改进 Monaco CDN 回退状态的追踪与编辑页加载提示。
