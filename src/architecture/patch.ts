import type { ComponentArchitecture, ComponentRegistryEntry, PatchVersion, ScopedCssBlock } from './types';

function cssEscapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function textLength(element: Element): number {
  return (element.textContent || '').replace(/\s+/g, ' ').trim().length;
}

function blockIds(element: Element): Set<string> {
  const ids = new Set<string>();
  const own = element.getAttribute('data-block-id');
  if (own) ids.add(own);
  element.querySelectorAll('[data-block-id]').forEach((node) => {
    const id = node.getAttribute('data-block-id');
    if (id) ids.add(id);
  });
  return ids;
}

export function createPatchVersion(
  architecture: ComponentArchitecture,
  componentId: string,
  html: string,
  reason: string,
): PatchVersion {
  return {
    id: `patch_${Date.now().toString(36)}`,
    componentId,
    html,
    registry: architecture.registry,
    scopedCss: architecture.scopedCss,
    createdAt: Date.now(),
    reason,
  };
}

export function validateComponentReplacement(target: Element, replacement: Element, blockId: string): boolean {
  if (target.tagName.toLowerCase() !== replacement.tagName.toLowerCase()) return false;
  if (replacement.getAttribute('data-block-id') !== blockId) return false;

  const originalIds = blockIds(target);
  const replacementIds = blockIds(replacement);
  if (originalIds.size >= 3) {
    let preserved = 0;
    originalIds.forEach((id) => {
      if (replacementIds.has(id)) preserved += 1;
    });
    if (preserved / originalIds.size < 0.6) return false;
  }

  const beforeText = textLength(target);
  const afterText = textLength(replacement);
  if (beforeText > 50 && afterText / beforeText < 0.5) return false;
  return true;
}

export function applyComponentPatch(html: string, blockId: string, replacementHtml: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const target = doc.querySelector(`[data-block-id="${cssEscapeAttr(blockId)}"]`);
  if (!target) return null;

  const replacementDoc = new DOMParser().parseFromString(replacementHtml, 'text/html');
  const replacement =
    replacementDoc.querySelector(`[data-block-id="${cssEscapeAttr(blockId)}"]`) ||
    replacementDoc.body.firstElementChild;
  if (!replacement) return null;
  if (!replacement.getAttribute('data-block-id')) replacement.setAttribute('data-block-id', blockId);
  if (!validateComponentReplacement(target, replacement, blockId)) return null;

  target.replaceWith(doc.importNode(replacement, true));
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

export function restorePatchVersion(version: PatchVersion): string {
  return version.html;
}

export function summarizeArchitectureCoverage(
  registry: ComponentRegistryEntry[],
  scopedCss: ScopedCssBlock[],
): Record<string, number> {
  return {
    registryEntries: registry.length,
    scopedCssBlocks: scopedCss.length,
    componentsWithCss: scopedCss.filter((block) => block.cssText.trim().length > 0).length,
  };
}
