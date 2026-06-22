# ADR-002: Dual-Layer Source Editing

## Status
Accepted

## Context
The PDF recommends routing simple size, position, color, and text changes through deterministic source edits instead of waiting for AI. Framewright currently stores each user prototype as a single HTML document, so that HTML source must remain the authority for preview, rollback, copy, and export.

## Decision
Use a dual-layer pipeline: the iframe preview captures gestures, then `html-source` applies safe DOM AST edits to the authoritative HTML source and syncs the result back to the preview. AI is reserved for surgical cleanup or structural edits when the source adapter cannot safely apply the batch.

## Rationale
This preserves the existing three-panel editing experience while making simple edits immediate. It also keeps the future TSX/CSS adapter path open through `SourceEditAdapter` without forcing a generated multi-file project in v1.

## Trade-offs
The current source adapter edits single-file HTML rather than real TSX/CSS files. This is acceptable because the app's current user artifact is HTML; a later adapter can target framework source files behind the same interface.

## Consequences
- Positive: local edits do not wait for AI, source/preview/rollback/export stay aligned, and metrics show skipped model calls.
- Negative: scoped CSS may retain pixel values for exact visual edits.
- Mitigation: background AI cleanup can still convert local edits into more responsive CSS when safe.
