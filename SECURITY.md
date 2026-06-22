# Security Policy

[简体中文](./SECURITY.zh-CN.md)

Framewright is an early-stage visual editing framework that runs AI-generated HTML inside a sandboxed iframe.

## Current Browser Isolation

The preview iframe uses:

```html
sandbox="allow-scripts allow-forms allow-modals allow-popups"
```

It intentionally does not use `allow-same-origin`. Generated code should not share the parent app origin or directly read the parent page's `localStorage`.

The parent app also ignores preview messages unless `event.source` matches the active iframe window.

## Known Risks

- Generated HTML can run JavaScript inside the iframe.
- Generated HTML can make network requests from the user's browser.
- Generated HTML may attempt to spoof inspector messages.
- Browser-stored API keys are acceptable only for local experimentation.
- Public deployments need a backend proxy for model calls.

## Hosted Deployment Guidance

If you deploy Framewright publicly:

1. Move model calls behind a backend proxy.
2. Never expose provider API keys to browser JavaScript.
3. Validate every `postMessage` payload.
4. Consider disabling arbitrary generated scripts unless they are required.
5. Add rate limits and abuse controls to model endpoints.
6. Review any future file-system, plugin, account, or deployment automation carefully.

## Reporting Issues

Please open a GitHub issue with a minimal reproduction and mark it as security-related. Do not include private API keys, secrets, or sensitive generated content.
