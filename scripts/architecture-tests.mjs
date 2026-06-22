import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function requireText(file, text) {
  const source = read(file);
  assert.ok(source.includes(text), `${file} should include ${text}`);
}

function testArchitectureExports() {
  const source = read('src/architecture/index.ts');
  [
    './dom',
    './ids',
    './manifest',
    './metrics',
    './patch',
    './prompt',
    './sourceEdit',
    './types',
  ].forEach((entry) => requireText('src/architecture/index.ts', entry));
  assert.ok(source.includes('export type *'), 'architecture types must be exported');
}

function testPdfStepCoverage() {
  requireText('src/architecture/dom.ts', 'buildComponentArchitecture');
  requireText('src/architecture/dom.ts', 'data-fw-id');
  requireText('src/architecture/dom.ts', 'data-block-id');
  requireText('src/architecture/dom.ts', 'shadowMap');
  requireText('src/architecture/prompt.ts', 'buildComponentPrompt');
  requireText('src/architecture/prompt.ts', 'cacheHit');
  requireText('src/architecture/sourceEdit.ts', 'classifyGestureBatch');
  requireText('src/architecture/sourceEdit.ts', 'applyGestureBatchToHtmlSource');
  requireText('src/architecture/sourceEdit.ts', 'mergeScopedStyleRule');
  requireText('src/architecture/sourceEdit.ts', 'validateSourcePreviewSync');
  requireText('src/architecture/sourceEdit.ts', 'data-fw-scope');
  requireText('src/architecture/patch.ts', 'applyComponentPatch');
  requireText('src/architecture/patch.ts', 'restorePatchVersion');
  requireText('src/architecture/manifest.ts', 'createMicroFrontendManifest');
  requireText('src/architecture/metrics.ts', 'createAiCallMetric');
}

function testAppIntegration() {
  requireText('src/App.tsx', 'buildComponentArchitecture');
  requireText('src/App.tsx', 'applyGestureBatchToHtmlSource');
  requireText('src/App.tsx', 'planLayoutCompilePrompt');
  requireText('src/App.tsx', 'applyComponentPatch');
  requireText('src/App.tsx', 'synced-local');
  requireText('src/App.tsx', 'Roll back last patch');
  requireText('src/components/PreviewStage.tsx', 'data-block-id');
  requireText('src/components/PreviewStage.tsx', 'componentPath');
}

testArchitectureExports();
testPdfStepCoverage();
testAppIntegration();
console.log('architecture tests passed');
