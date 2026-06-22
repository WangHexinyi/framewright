# 路线图

[English](./ROADMAP.md)

Framewright 是面向 AI 生成前端原型的可视化编辑框架。路线图优先关注编辑原语、源码同步和安全 AI 补丁。

## v0.1 - 初始开源版本

- 单文件 HTML 生成和预览。
- 沙盒 iframe inspector。
- 拖拽、缩放、行内文本编辑。
- 稳定 ID：`data-fw-id`、`data-block-id`、`data-frame-id`。
- 虚拟组件树和 Shadow Mapping。
- 简单修改通过本地 HTML DOM AST 写回。
- 复杂修改走 AI 局部补丁 fallback。
- 补丁快照和回滚。
- 架构测试和架构审计脚本。

## v0.2 - 编辑可靠性

- 更强的本地源码编辑 undo / redo。
- 更好的拖拽和缩放批处理。
- 更精确的 Scoped CSS 合并。
- 源码和预览同步诊断。
- 基于截图的交互测试。
- 本地 AST 写回被拒绝时提供更清晰的错误提示。

## v0.3 - Framework Adapter 层

- 实验性 TSX/CSS 源码适配器。
- Tailwind class 重写适配器。
- 面向生成组件树的 source map 或 manifest 格式。
- 更好的 React、Vue、静态 HTML 导出兼容层。
- 可供第三方工具接入的 adapter API。

## v0.4 - AI 补丁安全

- 结构化 AI patch schema。
- 更强的根标签、稳定 ID、文本保留率和受保护布局属性校验。
- 面向不安全 AI 修改的负例测试。
- 可配置的模型路由策略。
- 持久化语义缓存。

## 长期方向

- 多断点可视化编辑。
- 修改前后视觉 diff。
- 真正的 package 级微前端拆分。
- 适合协作的 action ledger。
- 面向公开部署的后端代理模板。
- 面向外部设计和代码工具的插件 API。
