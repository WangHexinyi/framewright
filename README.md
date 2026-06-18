# Framewright

[简体中文](./README.zh-CN.md)

Framewright is an AI interface sandbox for people who can judge design better than they can rewrite front-end code.

Generate a single-file HTML interface, visually reshape it in a sandboxed preview, then ask the model to compile those gestures into clean responsive CSS.

> Shape first. Code follows.

## Why this exists

Current AI front-end tools are good at generating a first draft, but weak at letting users directly express visual judgment. If a card should be wider, a hero should move up, or spacing should feel tighter, users are forced back into natural language.

Framewright adds the missing interaction layer:

1. AI generates an interface.
2. The user edits the result visually.
3. Framewright records those edits as structured gestures.
4. AI receives the HTML plus gesture ledger.
5. AI rewrites the layout as maintainable responsive code.

## MVP features

- React + TypeScript + Vite app.
- Sandboxed iframe preview using `srcdoc`.
- Inspect mode for selecting elements.
- Drag selected elements to move them.
- Resize selected elements with a handle.
- Double-click text to edit copy inline.
- Structured gesture ledger for `move`, `resize`, and `editText`.
- Gesture ledger preview, clear action, and JSON export.
- OpenAI-compatible streaming chat completions.
- Layout compiler prompt that asks the model to remove temporary transforms and inline sizing.
- Local compile checks for leftover temporary attributes, transforms, and inline pixel sizing.
- Parent page validates `postMessage` events against the active iframe window.
- Runtime validation for inspector message payloads.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

## API setup

Framewright calls an OpenAI-compatible `/chat/completions` endpoint from the browser.

Default values:

- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-chat`

For local experimentation this is convenient. For a public hosted deployment, route model calls through a backend proxy so API keys never live in the browser.

## Security notes

Generated HTML runs in an iframe with:

```html
sandbox="allow-scripts allow-forms allow-modals allow-popups"
```

The sandbox intentionally does not include `allow-same-origin`, so generated scripts should not be able to read the parent page's `localStorage`.

The parent also ignores inspector messages unless `event.source` matches the current iframe `contentWindow`.

This is still an early prototype. Treat untrusted generated HTML carefully, especially before adding file access, account auth, deployment, or plugin capabilities.

## Roadmap

See [ROADMAP.md](./ROADMAP.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT
