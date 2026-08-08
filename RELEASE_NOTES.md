# Release Notes

你好，这里是 Wikidot Editor Better / FuckiDot Editor 的 version 1.0.2-beta2 发布说明。

## 加载与稳定性

- Fix: Monaco 成功加载后正确结束“加载中”状态，避免编辑页尚未出现时产生误导性的加载诊断。
- Fix: 页面已存在 AMD 加载器时不再覆盖全局 `require` / `define`；已有 Monaco 直接复用，其他 AMD 环境自动改走 ESM 加载路径。
- Fix: Monaco 回滚到原生 textarea 时恢复字号调节按钮的原始事件与内容，避免重复初始化后控件失效或残留监听器。
- Test: 新增加载器自动化覆盖，验证预加载 Monaco 的复用、加载状态收敛与页面 AMD 全局变量保留。
