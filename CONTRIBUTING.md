# Contributing

Thanks for helping improve Framewright.

## Development Setup

```bash
npm install
npm run dev
```

Before submitting changes, run:

```bash
npm run lint
npm run build
npm run test
npm run audit:architecture
```

## Project Boundaries

Framewright is the open-source visual editing framework. Keep changes focused on:

- visual editing and inspector behavior
- source/prototype synchronization
- architecture primitives under `src/architecture`
- prompt pruning, patching, rollback, and metrics
- safety and deployment documentation

Do not commit local experiment logs, generated `dist/`, `node_modules/`, private API keys, or unrelated sandbox projects.

## Architecture Expectations

Important architecture changes should include:

- focused tests in `scripts/architecture-tests.mjs`
- audit coverage in `scripts/architecture-audit.mjs`
- an ADR under `docs/architecture/` when the decision changes long-term project direction

The source HTML is currently the authoritative user artifact. The iframe preview is an interaction surface, not the final source of truth.

## Pull Request Checklist

- [ ] The change is scoped and explained clearly.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test` passes.
- [ ] `npm run audit:architecture` passes.
- [ ] User-facing behavior is documented when relevant.
- [ ] Security implications are noted when generated HTML, model calls, or iframe messaging are affected.
