import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');

async function readSource(path) {
  return readFile(resolve(frontendRoot, path), 'utf8');
}

test('MCP plaza has a routed page and sidebar entry', async () => {
  const appSource = await readSource('src/App.tsx');
  const layoutSource = await readSource('src/layouts/MainLayout.tsx');

  assert.match(appSource, /McpPlaza/, 'App should lazy load the MCP plaza page');
  assert.match(appSource, /path="mcp"/, 'App should expose /mcp');
  assert.match(layoutSource, /MCP 广场/, 'Sidebar should include the MCP plaza entry');
  assert.match(layoutSource, /key: '\/mcp'/, 'Sidebar MCP item should navigate to /mcp');
});

test('MCP plaza page supports registering and presenting MCP servers', async () => {
  const pageSource = await readSource('src/pages/mcp/McpPlaza.tsx');

  assert.match(pageSource, /mcpApi\.register/, 'Plaza should call the registration API');
  assert.match(pageSource, /mcpApi\.marketplace/, 'Plaza should load marketplace data for presentation');
  assert.match(pageSource, /注册 MCP/, 'Plaza should expose a registration action');
  assert.match(pageSource, /transport/, 'Plaza should show transport configuration');
});

