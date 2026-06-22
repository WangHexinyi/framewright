# 安全策略

[English](./SECURITY.md)

Framewright 是早期阶段的可视化编辑框架，会在沙盒 iframe 中运行 AI 生成的 HTML。

## 当前浏览器隔离

预览 iframe 使用：

```html
sandbox="allow-scripts allow-forms allow-modals allow-popups"
```

这里刻意没有使用 `allow-same-origin`。因此生成代码不应与父应用共享同源身份，也不应直接读取父页面的 `localStorage`。

父应用也会检查 `postMessage` 来源，只接收当前 iframe `contentWindow` 发出的消息。

## 已知风险

- 生成的 HTML 可以在 iframe 中运行 JavaScript。
- 生成的 HTML 可以从用户浏览器发起网络请求。
- 生成的 HTML 可能尝试伪造 inspector 消息。
- API Key 保存在浏览器中只适合本地实验。
- 公开部署必须通过后端代理调用模型。

## 公开部署建议

如果公开部署 Framewright：

1. 把模型调用放到后端代理。
2. 不要把服务商 API Key 暴露给浏览器 JavaScript。
3. 校验所有 `postMessage` payload。
4. 如果不需要脚本能力，考虑禁用生成 HTML 中的任意脚本。
5. 给模型接口增加速率限制和滥用防护。
6. 后续加入文件系统、插件、账号或部署自动化时，需要重新做安全评估。

## 报告安全问题

请通过 GitHub issue 提交最小复现，并标明这是安全相关问题。不要在 issue 中包含 API Key、密钥或敏感生成内容。
