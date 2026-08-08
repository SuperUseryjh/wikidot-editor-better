# Release Notes

你好，这里是 Wikidot Editor Better / FuckiDot Editor 的 version 1.0.2-beta4 发布说明。

## Include 校验

- 新增 [[include ...]] 调用检查：识别参数格式、重复参数、被 include 页面不存在，以及模板参数缺失或未使用。
- 支持当前站点与跨站 include，正确解析 :页面、站点:页面 与包含额外冒号的页面名。
- 跨站读取模板源码使用 Tampermonkey 请求桥、站点 token 与 ViewSourceModule，并为成功结果增加当前编辑页会话内的 10 分钟缓存。

## 编辑体验

- 修复 Monaco 诊断提示在编辑器边缘被裁切的问题。
- 启用 Sticky Scroll，最多驻留 5 行；支持成对 Wikidot 标签、[[html]] 内的嵌套 HTML 标签以及 [[module CSS]]。
- 改进 Monaco CDN 加载与 AMD 隔离恢复逻辑，降低 Wikidot 页面环境冲突导致的加载失败。

## 脚本与资源

- 使用 SVG 项目 logo，并在构建 userscript 时自动生成 PNG Data URL 图标。
- 更新 userscript 元数据，补充跨站源码读取所需的 GM_cookie、GM_xmlhttpRequest 与连接权限。
