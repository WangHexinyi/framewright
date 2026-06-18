# Framewright

[English](./README.md)

Framewright 是一个 AI 界面设计沙盒，面向那些“审美判断强，但不想手写复杂前端代码”的用户。

你可以先让 AI 生成一个单文件 HTML 界面，然后在沙盒预览里直接拖拽、缩放、修改文字，最后让模型把这些可视化手势编译成干净、响应式的 CSS 代码。

> 先动手调设计，再让代码跟上。

## 为什么做这个项目

现在的 AI 前端工具很擅长生成第一版界面，但不擅长让用户直接表达视觉判断。

比如你觉得：

- 卡片应该更宽一点；
- Hero 区域应该往上移；
- 两个模块之间的间距应该更紧；
- 按钮应该更突出；
- 图片区域比例不对。

大多数工具都会要求你回到自然语言里描述这些变化。但很多时候，直接用鼠标拖一下、拉一下，比用语言解释更高效。

Framewright 想补上的就是这层交互：

1. AI 生成界面。
2. 用户直接在预览中修改界面。
3. Framewright 把这些修改记录成结构化手势。
4. AI 同时读取 HTML 和手势记录。
5. AI 把临时的拖拽/缩放结果重写成可维护的响应式代码。

## MVP 功能

- 基于 React + TypeScript + Vite。
- 使用 `srcdoc` iframe 进行沙盒预览。
- 检查模式：点击选择页面元素。
- 拖拽选中元素来移动位置。
- 使用右下角手柄调整元素尺寸。
- 双击文本进行行内编辑。
- 记录 `move`、`resize`、`editText` 三类结构化手势。
- 手势账本预览、清空和 JSON 导出。
- 支持 OpenAI-compatible 的流式 `/chat/completions` 接口。
- 内置 layout compiler prompt，引导模型移除临时 transform 和 inline sizing。
- 对 AI 编译结果做本地检查，提示残留的临时属性、transform 和像素级 inline 尺寸。
- 父页面只接收来自当前 iframe window 的 `postMessage`。
- 对 inspector 消息 payload 做运行时校验。

## 本地运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

## API 设置

Framewright 目前直接从浏览器调用 OpenAI-compatible `/chat/completions` 接口。

默认值：

- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-chat`

这对本地实验很方便。但如果你要公开部署，请把模型调用放到后端代理里，不要把 API Key 暴露在浏览器 JavaScript 中。

## 安全说明

生成的 HTML 会运行在 iframe 中：

```html
sandbox="allow-scripts allow-forms allow-modals allow-popups"
```

这里刻意没有加入 `allow-same-origin`，因此生成页面中的脚本不应该能直接读取父页面的 `localStorage`。

父页面也会检查 `postMessage` 的来源，只接收当前 iframe `contentWindow` 发出的消息。

不过这仍然是早期原型。在加入文件访问、账号系统、部署能力或插件系统之前，请谨慎处理不可信的生成 HTML。

## 路线图

见 [ROADMAP.zh-CN.md](./ROADMAP.zh-CN.md)。

## 安全策略

见 [SECURITY.zh-CN.md](./SECURITY.zh-CN.md)。

## 许可证

MIT
