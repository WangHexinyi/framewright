import type {
  ComponentArchitecture,
  EditRoute,
  SourceEditAdapter,
  SourceEditResult,
} from './types';
import type { GestureOperation } from '../types';

const SIMPLE_GESTURES = new Set(['move', 'resize', 'rotate', 'editText', 'style']);
const SCOPED_STYLE_ID = 'fw-source-edits';

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function actionId(): string {
  return `source_${Date.now().toString(36)}`;
}

function cssEscapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function operationTargetKeys(operation: GestureOperation): string[] {
  return [
    operation.blockId,
    operation.componentId,
    operation.frameId,
    operation.targetKey,
  ].filter((value): value is string => Boolean(value));
}

function findTarget(doc: Document, operation: GestureOperation): HTMLElement | null {
  for (const key of operationTargetKeys(operation)) {
    const escaped = cssEscapeAttr(key);
    const target = doc.querySelector<HTMLElement>(
      `[data-fw-id="${escaped}"],[data-block-id="${escaped}"],[data-frame-id="${escaped}"]`,
    );
    if (target) return target;
  }
  return null;
}

function serialize(doc: Document): string {
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

function readStyleMap(styleText: string | null): Map<string, string> {
  const map = new Map<string, string>();
  (styleText || '').split(';').forEach((part) => {
    const separator = part.indexOf(':');
    if (separator < 0) return;
    const property = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (property) map.set(property, value);
  });
  return map;
}

function writeStyleMap(element: HTMLElement, map: Map<string, string>): void {
  const next = Array.from(map.entries())
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ');
  if (next) {
    element.setAttribute('style', next);
  } else {
    element.removeAttribute('style');
  }
}

function removeInlineProperties(element: HTMLElement, properties: string[]): void {
  const map = readStyleMap(element.getAttribute('style'));
  properties.forEach((property) => map.delete(property));
  writeStyleMap(element, map);
}

function styleElement(doc: Document): HTMLStyleElement {
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[data-fw-scope="${SCOPED_STYLE_ID}"]`);
  if (existing) return existing;
  const style = doc.createElement('style');
  style.setAttribute('data-fw-scope', SCOPED_STYLE_ID);
  doc.head.appendChild(style);
  return style;
}

function declarationsToCss(declarations: Record<string, string>): string {
  return Object.entries(declarations)
    .filter(([, value]) => value.trim().length > 0)
    .map(([property, value]) => `  ${property}: ${value};`)
    .join('\n');
}

function readRuleDeclarations(source: string, selector: string): Record<string, string> {
  const pattern = new RegExp(`${regexEscape(selector)}\\s*\\{([^}]*)\\}`, 'm');
  const match = source.match(pattern);
  if (!match) return {};
  return Object.fromEntries(readStyleMap(match[1]).entries());
}

export function mergeScopedStyleRule(html: string, fwId: string, declarations: Record<string, string>): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const style = styleElement(doc);
  const selector = `[data-fw-id="${fwId}"]`;
  const source = style.textContent || '';
  const mergedDeclarations = { ...readRuleDeclarations(source, selector), ...declarations };
  const css = declarationsToCss(mergedDeclarations);
  if (!css) return serialize(doc);

  const rule = `${selector} {\n${css}\n}`;
  const pattern = new RegExp(`${regexEscape(selector)}\\s*\\{[^}]*\\}`, 'm');
  style.textContent = pattern.test(source)
    ? source.replace(pattern, rule)
    : `${source.trim() ? `${source.trim()}\n\n` : ''}${rule}`;
  return serialize(doc);
}

function mergeScopedDeclarations(doc: Document, fwId: string, declarations: Record<string, string>): void {
  const style = styleElement(doc);
  const selector = `[data-fw-id="${fwId}"]`;
  const source = style.textContent || '';
  const mergedDeclarations = { ...readRuleDeclarations(source, selector), ...declarations };
  const css = declarationsToCss(mergedDeclarations);
  if (!css) return;

  const rule = `${selector} {\n${css}\n}`;
  const pattern = new RegExp(`${regexEscape(selector)}\\s*\\{[^}]*\\}`, 'm');
  style.textContent = pattern.test(source)
    ? source.replace(pattern, rule)
    : `${source.trim() ? `${source.trim()}\n\n` : ''}${rule}`;
}

function mergeInlineDeclarations(target: HTMLElement, declarations: Record<string, string>): void {
  const map = readStyleMap(target.getAttribute('style'));
  Object.entries(declarations).forEach(([property, value]) => {
    if (value.trim()) map.set(property, value);
  });
  writeStyleMap(target, map);
}

function rectDelta(operation: GestureOperation): { x: number; y: number } {
  if (!operation.before || !operation.after) return { x: 0, y: 0 };
  return {
    x: operation.after.x - operation.before.x,
    y: operation.after.y - operation.before.y,
  };
}

function declarationsFor(operation: GestureOperation): Record<string, string> {
  const declarations: Record<string, string> = {};
  const operationType = String(operation.type);
  if (operationType === 'resize' && operation.after) {
    declarations.width = `${Math.max(1, Math.round(operation.after.width))}px`;
    declarations.height = `${Math.max(1, Math.round(operation.after.height))}px`;
  }
  if (operationType === 'move') {
    const delta = rectDelta(operation);
    declarations.transform = `translate3d(${Math.round(delta.x)}px, ${Math.round(delta.y)}px, 0)`;
  }
  const styleChange = (operation as GestureOperation & {
    styleChange?: { property: string; after: string };
  }).styleChange;
  if (operationType === 'style' && styleChange) {
    const property = styleChange.property.toLowerCase();
    declarations[property === 'background-color' ? 'background' : property] = styleChange.after;
  }
  return declarations;
}

function applyTextEdit(target: HTMLElement, operation: GestureOperation): boolean {
  if (operation.type !== 'editText') return false;
  if (typeof operation.textAfter !== 'string') return false;
  target.textContent = operation.textAfter;
  return true;
}

function ensureFwId(target: HTMLElement): string | null {
  const existing = target.getAttribute('data-fw-id');
  if (existing) return existing;
  const blockId = target.getAttribute('data-block-id');
  if (!blockId) return null;
  const fwId = blockId.replace(/^block_/, 'fw_');
  target.setAttribute('data-fw-id', fwId);
  return fwId;
}

export function classifyGestureBatch(
  operations: GestureOperation[],
  architecture: ComponentArchitecture,
): EditRoute {
  if (operations.length === 0) return 'ai-structural';
  const allSimple = operations.every((operation) => SIMPLE_GESTURES.has(operation.type));
  const allKnownTargets = operations.every((operation) =>
    operationTargetKeys(operation).some((key) =>
      architecture.registry.some(
        (entry) => entry.fwId === key || entry.blockId === key || entry.frameId === key || entry.id === key,
      ),
    ),
  );
  return allSimple && allKnownTargets ? 'local-source-ast' : 'ai-surgical';
}

export function applyGestureBatchToHtmlSource(
  html: string,
  operations: GestureOperation[],
  architecture: ComponentArchitecture,
): SourceEditResult {
  const startedAt = performance.now();
  const route = classifyGestureBatch(operations, architecture);
  if (route !== 'local-source-ast') {
    return {
      code: html,
      route,
      applied: false,
      actionId: actionId(),
      issues: [{ severity: 'warning', message: `Gesture batch routed to ${route}.` }],
      elapsedMs: elapsed(startedAt),
    };
  }

  const doc = new DOMParser().parseFromString(architecture.html || html, 'text/html');
  const issues: SourceEditResult['issues'] = [];
  let applied = 0;

  operations.forEach((operation) => {
    const target = findTarget(doc, operation);
    if (!target) {
      issues.push({ severity: 'error', message: `Target not found for ${operation.type}.` });
      return;
    }
    const fwId = ensureFwId(target);
    if (!fwId) {
      issues.push({ severity: 'error', message: `Target missing stable source id for ${operation.type}.` });
      return;
    }
    if (applyTextEdit(target, operation)) {
      applied += 1;
      return;
    }

    const declarations = declarationsFor(operation);
    if (Object.keys(declarations).length === 0) {
      issues.push({ severity: 'warning', message: `No source declarations generated for ${operation.type}.` });
      return;
    }
    mergeScopedDeclarations(doc, fwId, declarations);
    if (operation.type === 'style') {
      mergeInlineDeclarations(target, declarations);
    } else {
      removeInlineProperties(target, Object.keys(declarations));
    }
    applied += 1;
  });

  return {
    code: applied > 0 ? serialize(doc) : html,
    route,
    applied: applied > 0 && !issues.some((issue) => issue.severity === 'error'),
    actionId: actionId(),
    issues,
    elapsedMs: elapsed(startedAt),
  };
}

export function validateSourcePreviewSync(sourceHtml: string, previewHtml: string): SourceEditResult['issues'] {
  const sourceDoc = new DOMParser().parseFromString(sourceHtml, 'text/html');
  const previewDoc = new DOMParser().parseFromString(previewHtml, 'text/html');
  const sourceIds = sourceDoc.querySelectorAll('[data-fw-id]').length;
  const previewIds = previewDoc.querySelectorAll('[data-fw-id]').length;
  if (sourceIds !== previewIds) {
    return [{ severity: 'warning', message: 'Source and preview stable ID counts differ.' }];
  }
  return [];
}

export const htmlSourceEditAdapter: SourceEditAdapter = {
  kind: 'html-source',
  applyGestureBatch: ({ html, operations, architecture }) =>
    applyGestureBatchToHtmlSource(html, operations, architecture),
  serialize: (html) => serialize(new DOMParser().parseFromString(html, 'text/html')),
};
