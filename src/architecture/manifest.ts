import type { MicroFrontendManifest } from './types';

export function createMicroFrontendManifest(name: string): MicroFrontendManifest {
  return {
    name,
    version: '1.0.0',
    modules: [
      {
        id: 'designer',
        kind: 'react-module',
        entry: 'src/App.tsx',
        consumes: ['preview', 'ai-service', 'history'],
        exposes: ['component-tree', 'registry-panel'],
      },
      {
        id: 'preview',
        kind: 'iframe-host',
        entry: 'src/components/PreviewStage.tsx',
        consumes: ['designer'],
        exposes: ['inspect-mode', 'gesture-ledger', 'dom-morph'],
      },
      {
        id: 'ai-service',
        kind: 'react-module',
        entry: 'src/services/llm.ts',
        consumes: ['designer'],
        exposes: ['prompt-routing', 'semantic-cache', 'metrics'],
      },
      {
        id: 'history',
        kind: 'web-component-adapter',
        entry: 'src/architecture/patch.ts',
        consumes: ['designer', 'preview'],
        exposes: ['patch-version', 'rollback'],
      },
    ],
  };
}
