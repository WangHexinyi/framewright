# 安全策略

[English](./SECURITY.md)

Framewright 是一个早期原型，会在沙盒 iframe 中运行 AI 生成的 HTML。

## 当前浏览器隔离方式

预览 iframe 使用：

```html
sandbox="allow-scripts allow-forms allow-modals allow-popups"
```

这里刻意没有使用 `allow-same-origin`。这样生成代码不会和父应用共享同源权限，也就不应该能直接读取父页面的 `localStorage`。

父应用还会忽略不是来自当前 iframe window 的预览消息。

## 已知风险

- 生成代码可以在 iframe 内运行 JavaScript。
- 生成代码可以从用户浏览器发起网络请求。
- 生成代码可能尝试伪造 Framewright inspector 消息。
- API Key 存在浏览器里只适合本地实验，不适合公开托管产品。

## 公开部署建议

如果你要公开部署 Framewright：

1. 把模型调用移到后端代理。
2. 不要把模型供应商 API Key 暴露给浏览器 JavaScript。
3. 对所有 `postMessage` payload 做 schema 校验。
4. 如果不是必须，考虑禁用任意生成脚本。
5. 给模型接口增加限流和滥用防护。

## 报告问题

请在 GitHub issue 中提供最小复现，并标注这是安全相关问题。不要在 issue 中包含私有 API Key 或敏感用户数据。
