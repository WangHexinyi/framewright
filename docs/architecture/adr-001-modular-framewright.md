# ADR-001: Modular Component Architecture

## Status
Accepted

## Context
Framewright needs lower AI wait time without losing direct visual editing. The PDF requires stable module IDs, a virtual component tree, Scoped CSS, Shadow Mapping, prompt pruning, patch rollback, and a micro frontend path.

## Decision
Use a modular monolith v1 inside the existing React/Vite apps. Add `src/architecture` as the shared boundary for component registry, ID generation, component tree serialization, scoped prompt construction, semantic cache keys, patch validation, rollback, metrics, and a micro frontend manifest.

## Rationale
This keeps the current editor experience intact while making the AI sync path component-scoped. Real package-level micro frontends can be extracted later because the manifest already names the runtime modules.

## Trade-offs
The first version still runs in one bundle, so teams cannot deploy modules independently yet. This is acceptable for an open-source v1 because it avoids premature distributed complexity while preserving the future extraction boundary.

## Consequences
- Positive: smaller prompts, safer patching, testable architecture primitives.
- Negative: DOM parsing and CSS scoping are conservative and not a full CSS AST.
- Mitigation: audit script and patch validation reject unsafe replacements; future work can replace CSS extraction with an AST parser.
