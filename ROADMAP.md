# Roadmap

[简体中文](./ROADMAP.zh-CN.md)

## v0.1

- Single-file HTML generation.
- Sandboxed visual preview.
- Inspect mode selection.
- Drag, resize, and inline text editing.
- Gesture ledger for layout compilation.
- OpenAI-compatible model calls.

## v0.2

- Undo and redo for gesture operations.
- Stronger `postMessage` payload validation.
- Post-compile validator that flags leftover temporary transforms, inline sizing, and `data-frame-id` attributes.
- Export operation ledger as JSON.
- Better streaming DOM morphing instead of iframe reloads.

## v0.3

- Multi-breakpoint gesture recording.
- Visual before/after diff view.
- React component export.
- Tailwind export.
- Backend proxy option for hosted deployments.

## Long-term

Framewright should become a visual intent compiler for AI-generated UI: users express design judgment through direct manipulation, and AI turns that judgment into maintainable front-end code.
