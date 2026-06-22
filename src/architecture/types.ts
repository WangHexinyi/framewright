import type { GestureOperation } from '../types';

export interface ComponentNode {
  id: string;
  fwId?: string;
  blockId: string;
  frameId?: string;
  type: string;
  tagName: string;
  path: string[];
  props: Record<string, string>;
  textContent: string;
  children: ComponentNode[];
}

export interface ComponentRegistryEntry {
  id: string;
  fwId?: string;
  blockId: string;
  frameId?: string;
  parentId: string | null;
  path: string[];
  type: string;
  tagName: string;
  props: Record<string, string>;
  childIds: string[];
  version: number;
}

export interface ScopedCssBlock {
  componentId: string;
  blockId: string;
  cssText: string;
  selectorHints: string[];
  hash: string;
}

export interface ShadowMappingEntry {
  publicId: string;
  internalId: string;
  fwId?: string;
  blockId: string;
  frameId?: string;
  path: string[];
  version: number;
}

export interface PatchVersion {
  id: string;
  componentId: string;
  html: string;
  registry: ComponentRegistryEntry[];
  scopedCss: ScopedCssBlock[];
  createdAt: number;
  reason: string;
}

export interface MicroFrontendManifest {
  name: string;
  version: string;
  modules: Array<{
    id: 'designer' | 'preview' | 'ai-service' | 'history';
    kind: 'react-module' | 'web-component-adapter' | 'iframe-host';
    entry: string;
    consumes: string[];
    exposes: string[];
  }>;
}

export interface ComponentArchitecture {
  html: string;
  root: ComponentNode | null;
  registry: ComponentRegistryEntry[];
  scopedCss: ScopedCssBlock[];
  shadowMap: ShadowMappingEntry[];
  manifest: MicroFrontendManifest;
  version: number;
}

export interface PromptBuildResult {
  prompt: string;
  componentId: string;
  blockId: string;
  promptChars: number;
  route: 'local-rule' | 'small-model' | 'large-model' | EditRoute;
  cacheKey: string;
  cacheHit: boolean;
}

export interface PromptCacheEntry {
  key: string;
  prompt: string;
  response: string;
  createdAt: number;
}

export interface AiCallMetric {
  id: string;
  componentId: string;
  route: PromptBuildResult['route'];
  promptChars: number;
  cacheHit: boolean;
  responseMs: number;
  patchApplied: boolean;
  createdAt: number;
}

export interface ComponentPromptInput {
  architecture: ComponentArchitecture;
  componentId: string | null;
  html: string;
  operations: GestureOperation[];
  instruction: string;
  cache?: PromptCacheEntry[];
}

export interface StableElementId {
  fwId?: string;
  blockId?: string;
  frameId?: string;
  path: string[];
  version: number;
}

export type EditRoute = 'local-source-ast' | 'ai-surgical' | 'ai-structural';

export interface SourceEditResult {
  code: string;
  route: EditRoute;
  applied: boolean;
  actionId: string;
  issues: Array<{ severity: 'warning' | 'error'; message: string }>;
  elapsedMs: number;
}

export interface SourceEditAdapter {
  kind: 'html-source';
  applyGestureBatch(input: {
    html: string;
    operations: GestureOperation[];
    architecture: ComponentArchitecture;
  }): SourceEditResult;
  serialize(html: string): string;
}
