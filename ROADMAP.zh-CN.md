# 路线图

[English](./ROADMAP.md)

## v0.1

- 单文件 HTML 生成。
- 沙盒化可视化预览。
- 检查模式选择元素。
- 拖拽、缩放、行内文本编辑。
- 用于布局编译的手势记录。
- OpenAI-compatible 模型调用。

## v0.2

- 手势操作的撤销和重做。
- 更严格的 `postMessage` payload 校验。
- AI 编译后的本地校验：检查残留的临时 transform、inline sizing 和 `data-frame-id`。
- 导出 gesture ledger JSON。
- 用 DOM morphing 改善流式预览，减少 iframe 重载。

## v0.3

- 多断点手势记录。
- 编辑前后视觉 diff。
- React 组件导出。
- Tailwind 导出。
- 面向公开部署的后端代理方案。

## 长期方向

Framewright 应该成为 AI 生成 UI 的“视觉意图编译器”：用户通过直接操作表达设计判断，AI 负责把这些判断转换成可维护的前端代码。
