export type McpTransport = 'stdio' | 'streamable_http' | 'sse';
export type McpSource = 'marketplace' | 'json' | 'manual' | 'registered';
export type McpCategory = 'files' | 'web' | 'data' | 'memory' | 'dev' | 'custom';

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
  source?: McpSource;
  package?: string;
  referenceUrl?: string;
  capabilities?: string[];
  category?: McpCategory;
  requires?: string[];
  disabled?: boolean;
}

export interface McpMarketplaceItem extends McpServerConfig {
  category: McpCategory;
  requires?: string[];
  ownerId?: number | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
