# Release Notes

你好，这里是 Wikidot Editor Better / FuckiDot Editor 的 version 1.0.2 正式版发布说明。

## 编辑页体验

- 新增完整编辑页覆写：工具栏、编辑器容器、状态栏、表单、锁定提示与操作按钮统一为现代化明暗主题界面。
- 工具栏改用 Lucide 图标库与 CSS mask 渲染，兼容 Wikidot 异步插入的工具项及标题子菜单。
- 底部操作按钮使用图标代理按钮和加载状态；“显示变更”采用 VS Code 风格 diff 外观，并支持深色模式。
- 统一 Wikidot hovertip 的明暗主题与层叠优先级；工具栏编辑操作可进入 Monaco 撤销栈，列表续行功能也已修复。

## 配置与加载稳定性

- 新增油猴菜单设置页，可按需关闭完整编辑页覆写，同时保留 Monaco 对原生 textarea 的替换。
- 改进 Monaco 多 CDN 加载、回退提示与 AMD 隔离恢复机制，避免覆盖页面已有的 AMD 全局变量，并修复加载状态与回滚恢复问题。
- 修复 Monaco 诊断提示在编辑器边缘被裁切的问题。

## Include 校验

- 新增 [[include ...]] 调用检查：识别参数格式、重复参数、被 include 页面不存在，以及模板参数缺失或未使用。
- 支持当前站点与跨站 include，正确解析 :页面、站点:页面 与包含额外冒号的页面名。
- 跨站读取模板源码使用 Tampermonkey 请求桥、站点 token 与 ViewSourceModule，并为成功结果增加当前编辑页会话内的 10 分钟缓存。

## 代码结构驻留

- 启用 Sticky Scroll，最多驻留 5 行；支持成对 Wikidot 标签、[[html]] 内嵌套的 HTML 标签，以及 [[module CSS]]。

## 脚本与资源

- 使用 SVG 项目 logo，并在构建 userscript 时自动生成 PNG Data URL 图标。
- 更新 userscript 元数据，补充跨站源码读取所需的 GM_cookie、GM_xmlhttpRequest 与连接权限。

## 测试

- 扩充 Monaco 加载、include 解析、图标生成与 Wikidot 块标签识别的自动化覆盖。
