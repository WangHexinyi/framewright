# Roadmap

[简体中文](./ROADMAP.zh-CN.md)

Framewright is a framework for visual editing of AI-generated front-end prototypes. The roadmap prioritizes editing primitives, source synchronization, and safe AI patching.

## v0.1 - Initial Open Source Release

- Single-file HTML generation and preview.
- Sandboxed iframe inspector.
- Drag, resize, and inline text editing.
- Stable IDs with `data-fw-id`, `data-block-id`, and `data-frame-id`.
- Virtual component tree and shadow mapping.
- Local HTML DOM AST writeback for simple edits.
- AI surgical fallback for complex edits.
- Patch snapshots and rollback.
- Architecture test and audit scripts.

## v0.2 - Editing Reliability

- Stronger undo/redo for local source edits.
- Better multi-operation batching for repeated drag and resize gestures.
- More precise scoped CSS merge behavior.
- Visual source/preview sync diagnostics.
- Screenshot-based interaction tests.
- Better error surfaces when local AST writeback is rejected.

## v0.3 - Framework Adapter Layer

- Experimental TSX/CSS source adapter.
- Tailwind class rewrite adapter.
- Source map or manifest format for generated component trees.
- Better compatibility layer for React, Vue, and static HTML exports.
- Exportable adapter API for third-party tools.

## v0.4 - AI Patch Safety

- Structured AI patch schema.
- Stronger patch validation for root tags, stable IDs, text retention, and protected layout properties.
- Negative test fixtures for unsafe AI edits.
- Model route policy configuration.
- Persistent semantic cache.

## Long Term

- Multi-breakpoint visual editing.
- Visual before/after diff.
- Real package-level micro-frontend extraction.
- Collaboration-friendly action ledger.
- Backend proxy template for hosted deployments.
- Plugin API for external design and code tools.
