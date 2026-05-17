import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');

test('platform shell marks the product as beta beside the brand', () => {
  const layoutSource = readFileSync(resolve(root, 'src/layouts/MainLayout.tsx'), 'utf8');
  const cssSource = readFileSync(resolve(root, 'src/index.css'), 'utf8');

  assert.match(layoutSource, /platform-beta-badge/, 'Layout should render a beta badge beside the brand');
  assert.match(layoutSource, />BETA</, 'Badge copy should be BETA');
  assert.match(cssSource, /\.platform-beta-badge/, 'Beta badge should have dedicated styling');
});
