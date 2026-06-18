# Deployment

Framewright is a Vite static app. The default build output is `dist/`.

## Local preview

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Vercel

Use these settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Netlify

Use these settings:

- Build command: `npm run build`
- Publish directory: `dist`

## GitHub Pages

For a user or organization site, deploy `dist/` after running:

```bash
npm run build
```

For a project page under `/repo-name/`, set Vite `base` before deploying. This project currently assumes root hosting.

## Important API key note

The MVP calls OpenAI-compatible model endpoints from browser JavaScript. This is acceptable for local experimentation, but not for a public production deployment.

For a public deployment, add a small backend proxy:

1. Browser sends prompt data to your backend.
2. Backend attaches the provider API key.
3. Backend streams the model response back to the browser.

Do not expose provider API keys in public browser code.
