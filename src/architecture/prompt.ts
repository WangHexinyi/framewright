import type { GestureOperation } from '../types';
import { stableHash } from './ids';
import { findComponent, serializeComponentHtml } from './dom';
import type { ComponentPromptInput, PromptBuildResult, PromptCacheEntry } from './types';

function operationTarget(operation: GestureOperation): string {
  return operation.blockId || operation.componentId || operation.targetKey || operation.frameId;
}

function normalizeOperations(operations: GestureOperation[]): string {
  return operations
    .map((operation) => {
      const target = operationTarget(operation);
      const after = operation.after ? `${operation.after.x},${operation.after.y},${operation.after.width},${operation.after.height}` : '';
      return `${operation.type}:${target}:${after}:${operation.textAfter || ''}`;
    })
    .join('|');
}

function similarity(a: string, b: string): number {
  const aTokens = new Set(a.toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean));
  const bTokens = new Set(b.toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean));
  if (aTokens.size === 0 && bTokens.size === 0) return 1;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function chooseRoute(operations: GestureOperation[]): PromptBuildResult['route'] {
  if (operations.length > 0 && operations.every((operation) => operation.type === 'editText')) return 'local-rule';
  if (operations.length <= 2 && operations.every((operation) => operation.type === 'move' || operation.type === 'resize')) {
    return 'small-model';
  }
  return 'large-model';
}

function findCache(cache: PromptCacheEntry[] | undefined, key: string, prompt: string): boolean {
  if (!cache || cache.length === 0) return false;
  return cache.some((entry) => entry.key === key || similarity(entry.prompt, prompt) >= 0.9);
}

export function buildComponentPrompt(input: ComponentPromptInput): PromptBuildResult {
  const component = findComponent(input.architecture, input.componentId);
  const componentId = component?.id || input.componentId || 'body';
  const blockId = component?.blockId || componentId;
  const relatedOperations = input.operations.filter((operation) => operationTarget(operation) === blockId || operationTarget(operation) === componentId);
  const operations = relatedOperations.length > 0 ? relatedOperations : input.operations.slice(-1);
  const fragment = serializeComponentHtml(input.architecture.html || input.html, blockId);
  const css = input.architecture.scopedCss
    .filter((block) => block.componentId === componentId || block.blockId === blockId)
    .map((block) => block.cssText)
    .join('\n\n');
  const parentPath = component?.path.slice(0, -1).join('/') || 'body';

  const prompt = `You are Framewright's modular surgical layout compiler.

Update only the target component. Preserve unrelated components.

Target component:
- componentId: ${componentId}
- blockId: ${blockId}
- parentPath: ${parentPath}
- tagName: ${component?.tagName || 'body'}

Parent context:
\`\`\`json
${JSON.stringify(component?.path || ['body'])}
\`\`\`

Scoped CSS:
\`\`\`css
${css || '/* no scoped CSS found for this component */'}
\`\`\`

Gesture ledger:
\`\`\`json
${JSON.stringify(operations, null, 2)}
\`\`\`

Target HTML:
\`\`\`html
${fragment}
\`\`\`

Instruction:
${input.instruction}`;

  const cacheKey = stableHash(`${blockId}:${normalizeOperations(operations)}:${stableHash(css)}:${stableHash(fragment)}`);
  const cacheHit = findCache(input.cache, cacheKey, prompt);
  return {
    prompt,
    componentId,
    blockId,
    promptChars: prompt.length,
    route: chooseRoute(operations),
    cacheKey,
    cacheHit,
  };
}
