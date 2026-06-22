import type { ElementRect, GestureOperation, GestureType, SelectedElement } from '../types';

const gestureTypes = new Set<GestureType>(['move', 'resize', 'editText']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRect(value: unknown): value is ElementRect {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.width) &&
    isNumber(value.height)
  );
}

export function isGestureOperation(value: unknown): value is GestureOperation {
  if (!isRecord(value)) return false;

  const context = value.context;
  const viewport = isRecord(context) ? context.viewport : null;

  return (
    isString(value.id) &&
    gestureTypes.has(value.type as GestureType) &&
    isString(value.frameId) &&
    (value.targetKey === undefined || isString(value.targetKey)) &&
    (value.blockId === undefined || isString(value.blockId)) &&
    (value.componentId === undefined || isString(value.componentId)) &&
    isString(value.tagName) &&
    isString(value.selectorPath) &&
    isRect(value.before) &&
    isRect(value.after) &&
    isString(value.inlineStyleAfter) &&
    isRecord(context) &&
    isRecord(viewport) &&
    isNumber(viewport.width) &&
    isNumber(viewport.height) &&
    isNumber(value.createdAt)
  );
}

export function isSelectedElement(value: unknown): value is SelectedElement {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    isString(value.frameId) &&
    (value.blockId === undefined || isString(value.blockId)) &&
    (value.componentId === undefined || isString(value.componentId)) &&
    isString(value.tagName) &&
    isString(value.selectorPath) &&
    isString(value.textContent) &&
    isString(value.outerHTML)
  );
}

export interface CompileIssue {
  severity: 'warning' | 'error';
  message: string;
}

export function validateCompiledHtml(html: string): CompileIssue[] {
  const issues: CompileIssue[] = [];

  if (/\sdata-frame-id=/i.test(html)) {
    issues.push({
      severity: 'warning',
      message: 'Compiled HTML still contains data-frame-id attributes.',
    });
  }

  if (/transform\s*:\s*translate/i.test(html)) {
    issues.push({
      severity: 'warning',
      message: 'Compiled CSS still contains transform: translate(...).',
    });
  }

  if (/style=["'][^"']*(?:width|height)\s*:\s*\d+px/i.test(html)) {
    issues.push({
      severity: 'warning',
      message: 'Compiled HTML still contains pixel width/height inline styles.',
    });
  }

  if (!/<style[\s>]/i.test(html)) {
    issues.push({
      severity: 'error',
      message: 'Compiled HTML does not include a <style> block.',
    });
  }

  if (!/<meta\s+name=["']viewport["']/i.test(html)) {
    issues.push({
      severity: 'warning',
      message: 'Compiled HTML is missing a viewport meta tag.',
    });
  }

  return issues;
}
