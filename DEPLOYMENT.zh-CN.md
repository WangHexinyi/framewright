# 部署说明

Framewright 是一个 Vite 静态应用，默认构建产物在 `dist/`。

## 本地预览

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## Vercel

使用以下设置：

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Netlify

使用以下设置：

- Build command: `npm run build`
- Publish directory: `dist`

## GitHub Pages

如果部署到用户或组织站点，运行：

```bash
npm run build
```

然后发布 `dist/`。

如果部署到 `/repo-name/` 这种项目路径，需要先设置 Vite 的 `base`。当前项目默认按根路径部署。

## API Key 重要说明

当前 MVP 会直接从浏览器 JavaScript 调用 OpenAI-compatible 模型接口。这适合本地实验，但不适合公开生产部署。

公开部署时应该增加一个小后端代理：

1. 浏览器把 prompt 数据发给后端。
2. 后端附加模型供应商 API Key。
3. 后端把模型流式响应转发回浏览器。

不要把模型供应商 API Key 暴露在公开浏览器代码中。
