import { ensureUniqueId, generateBlockId, stableHash } from './ids';
import { createMicroFrontendManifest } from './manifest';
import type {
  ComponentArchitecture,
  ComponentNode,
  ComponentRegistryEntry,
  ScopedCssBlock,
  ShadowMappingEntry,
} from './types';

const IGNORED_TAGS = new Set(['script', 'style', 'meta', 'link', 'title']);

function readProps(element: Element): Record<string, string> {
  const props: Record<string, string> = {};
  Array.from(element.attributes).forEach((attribute) => {
    props[attribute.name] = attribute.value;
  });
  return props;
}

function labelFor(element: Element, siblingIndex: number): string {
  const explicit =
    element.getAttribute('data-fw-id') ||
    element.getAttribute('data-block-id') ||
    element.getAttribute('id') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('data-frame-id');
  if (explicit) return explicit;
  return `${element.tagName.toLowerCase()}${siblingIndex + 1}`;
}

function assignBlockIds(root: ParentNode, seenBlockIds: Set<string>, seenFwIds: Set<string>, path: string[] = []): void {
  Array.from(root.children).forEach((element, index) => {
    const tagName = element.tagName.toLowerCase();
    if (IGNORED_TAGS.has(tagName)) return;

    const childPath = [...path, labelFor(element, index)];
    const existing = element.getAttribute('data-block-id');
    const blockId = existing || ensureUniqueId(generateBlockId(childPath, tagName), seenBlockIds);
    if (existing) seenBlockIds.add(existing);
    element.setAttribute('data-block-id', blockId);

    const existingFwId = element.getAttribute('data-fw-id');
    const fwId = existingFwId || ensureUniqueId(blockId.replace(/^block_/, 'fw_'), seenFwIds);
    if (existingFwId) seenFwIds.add(existingFwId);
    element.setAttribute('data-fw-id', fwId);

    if (!element.getAttribute('data-frame-id')) {
      element.setAttribute('data-frame-id', blockId.replace(/^block_/, 'frame_'));
    }
    assignBlockIds(element, seenBlockIds, seenFwIds, childPath);
  });
}

function buildTree(element: Element, parentId: string | null, path: string[], registry: ComponentRegistryEntry[]): ComponentNode {
  const blockId = element.getAttribute('data-block-id') || generateBlockId(path, element.tagName.toLowerCase());
  const fwId = element.getAttribute('data-fw-id') || undefined;
  const frameId = element.getAttribute('data-frame-id') || undefined;
  const id = blockId;
  const childElements = Array.from(element.children).filter((child) => !IGNORED_TAGS.has(child.tagName.toLowerCase()));
  const children = childElements.map((child, index) => {
    const childPath = [...path, child.getAttribute('data-block-id') || labelFor(child, index)];
    return buildTree(child, id, childPath, registry);
  });

  const node: ComponentNode = {
    id,
    fwId,
    blockId,
    frameId,
    type: element.tagName.toLowerCase(),
    tagName: element.tagName.toLowerCase(),
    path,
    props: readProps(element),
    textContent: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    children,
  };

  registry.push({
    id,
    fwId,
    blockId,
    frameId,
    parentId,
    path,
    type: node.type,
    tagName: node.tagName,
    props: node.props,
    childIds: children.map((child) => child.id),
    version: 1,
  });

  return node;
}

function extractScopedCss(doc: Document, registry: ComponentRegistryEntry[]): ScopedCssBlock[] {
  const cssText = Array.from(doc.querySelectorAll('style'))
    .map((style) => style.textContent || '')
    .join('\n\n');

  return registry.map((entry) => {
    const selectorHints = [`[data-block-id="${entry.blockId}"]`];
    if (entry.fwId) selectorHints.push(`[data-fw-id="${entry.fwId}"]`);
    if (entry.frameId) selectorHints.push(`[data-frame-id="${entry.frameId}"]`);
    const matchedRules = cssText
      .split('}')
      .map((rule) => rule.trim())
      .filter((rule) => rule && selectorHints.some((selector) => rule.includes(selector)))
      .map((rule) => `${rule}}`)
      .join('\n');
    const scopedText = matchedRules || `/* scoped:${entry.blockId} inherits page styles */`;
    return {
      componentId: entry.id,
      blockId: entry.blockId,
      cssText: scopedText,
      selectorHints,
      hash: stableHash(scopedText),
    };
  });
}

export function buildComponentArchitecture(html: string, manifestName: string): ComponentArchitecture {
  if (!html.trim()) {
    return {
      html,
      root: null,
      registry: [],
      scopedCss: [],
      shadowMap: [],
      manifest: createMicroFrontendManifest(manifestName),
      version: Date.now(),
    };
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seenBlockIds = new Set<string>();
  const seenFwIds = new Set<string>();
  assignBlockIds(doc.body, seenBlockIds, seenFwIds);
  const registry: ComponentRegistryEntry[] = [];
  const bodyPath = ['body'];
  const root = buildTree(doc.body, null, bodyPath, registry);
  const scopedCss = extractScopedCss(doc, registry);
  const shadowMap: ShadowMappingEntry[] = registry.map((entry) => ({
    publicId: entry.fwId || entry.blockId,
    internalId: entry.id,
    fwId: entry.fwId,
    blockId: entry.blockId,
    frameId: entry.frameId,
    path: entry.path,
    version: entry.version,
  }));

  return {
    html: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`,
    root,
    registry,
    scopedCss,
    shadowMap,
    manifest: createMicroFrontendManifest(manifestName),
    version: Date.now(),
  };
}

export function findComponent(architecture: ComponentArchitecture, componentId: string | null): ComponentRegistryEntry | null {
  if (!componentId) return architecture.registry[0] || null;
  return (
    architecture.registry.find((entry) =>
      entry.id === componentId ||
      entry.fwId === componentId ||
      entry.blockId === componentId ||
      entry.frameId === componentId ||
      entry.path.join('/') === componentId
    ) || null
  );
}

export function serializeComponentHtml(html: string, componentId: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const escaped = componentId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const target =
    doc.querySelector(`[data-fw-id="${escaped}"]`) ||
    doc.querySelector(`[data-block-id="${escaped}"]`) ||
    doc.querySelector(`[data-frame-id="${escaped}"]`) ||
    doc.body;
  return target.outerHTML;
}
