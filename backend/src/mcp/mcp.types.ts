export type McpTransport = 'stdio' | 'streamable_http' | 'sse';

export interface McpServerConfig {
  id?: string;
  name: string;
  transport: McpTransport;
  description?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  source?: 'marketplace' | 'json' | 'manual';
  package?: string;
  referenceUrl?: string;
  capabilities?: string[];
  disabled?: boolean;
}

export interface McpMarketplaceItem extends McpServerConfig {
  category: 'files' | 'web' | 'data' | 'memory' | 'dev';
  requires?: string[];
}
