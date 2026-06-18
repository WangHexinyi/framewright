# Security Policy

[简体中文](./SECURITY.zh-CN.md)

Framewright is an early prototype that runs AI-generated HTML inside a sandboxed iframe.

## Current browser isolation

The preview iframe uses:

```html
sandbox="allow-scripts allow-forms allow-modals allow-popups"
```

It intentionally does not use `allow-same-origin`. This prevents generated code from sharing the parent app origin and directly reading parent `localStorage`.

The parent app also ignores preview messages unless `event.source` matches the active iframe window.

## Known risks

- Generated code can run JavaScript inside the iframe.
- Generated code can make network requests from the user's browser.
- Generated code can attempt to spoof Framewright inspector messages from inside the iframe.
- Browser-stored API keys are acceptable for local experimentation, but not for a public hosted product.

## Hosted deployment guidance

If you deploy Framewright publicly:

1. Move model calls behind a backend proxy.
2. Never expose provider API keys to browser JavaScript.
3. Add schema validation for every `postMessage` payload.
4. Consider disabling arbitrary generated scripts unless explicitly needed.
5. Add rate limits and abuse controls to model endpoints.

## Reporting issues

Please open a GitHub issue with a minimal reproduction and mark it as security-related. Do not include private API keys or sensitive user data.
