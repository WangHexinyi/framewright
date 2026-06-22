import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const checks = [
  ['step 1 project structure', ['src/architecture/manifest.ts', 'src/architecture/index.ts']],
  ['step 2 registry and ids', ['src/architecture/ids.ts', 'src/architecture/dom.ts']],
  ['step 3 component tree and shadow mapping', ['src/architecture/types.ts', 'src/architecture/dom.ts']],
  ['step 4 prompt pruning router cache metrics', ['src/architecture/prompt.ts', 'src/architecture/metrics.ts']],
  ['step 4b source AST fast edit', ['src/architecture/sourceEdit.ts']],
  ['step 5 patch merge and rollback', ['src/architecture/patch.ts', 'src/App.tsx']],
  ['step 6 micro frontend adapter', ['src/architecture/manifest.ts']],
];

const requiredTerms = [
  'ComponentNode',
  'ComponentRegistryEntry',
  'ScopedCssBlock',
  'ShadowMappingEntry',
  'PatchVersion',
  'MicroFrontendManifest',
  'StableElementId',
  'SourceEditAdapter',
  'buildComponentPrompt',
  'cacheHit',
  'classifyGestureBatch',
  'applyGestureBatchToHtmlSource',
  'mergeScopedStyleRule',
  'validateSourcePreviewSync',
  'applyComponentPatch',
  'restorePatchVersion',
  'createAiCallMetric',
];

const allSource = [
  'src/architecture/types.ts',
  'src/architecture/dom.ts',
  'src/architecture/prompt.ts',
  'src/architecture/patch.ts',
  'src/architecture/metrics.ts',
  'src/architecture/manifest.ts',
  'src/architecture/sourceEdit.ts',
  'src/App.tsx',
].map((file) => readFileSync(join(root, file), 'utf8')).join('\n');

checks.forEach(([label, files]) => {
  files.forEach((file) => assert.ok(existsSync(join(root, file)), `${label}: missing ${file}`));
});

requiredTerms.forEach((term) => {
  assert.ok(allSource.includes(term), `architecture audit missing ${term}`);
});

console.log('architecture audit passed');
checks.forEach(([label]) => console.log(`- ${label}`));
