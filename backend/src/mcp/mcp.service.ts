import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { McpServer } from '../entities';
import { McpCategory, McpMarketplaceItem, McpServerConfig, McpSource, McpTransport } from './mcp.types';

const MARKETPLACE: McpMarketplaceItem[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: '读写指定目录内的本地文件，适合文档、模板和产物工作区。',
    category: 'files',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/workspace'],
    package: '@modelcontextprotocol/server-filesystem',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['files.read', 'files.write'],
    requires: ['把 /path/to/workspace 改成允许访问的目录'],
    source: 'marketplace',
  },
  {
    id: 'memory',
    name: 'Memory',
    description: '轻量知识图谱记忆，用于跨会话保存事实、实体和关系。',
    category: 'memory',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    package: '@modelcontextprotocol/server-memory',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['memory.read', 'memory.write'],
    source: 'marketplace',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: '连接 PostgreSQL 执行只读查询，适合业务数据分析和看板问答。',
    category: 'data',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:password@host:5432/db'],
    package: '@modelcontextprotocol/server-postgres',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['db.query'],
    requires: ['替换连接串，建议使用只读账号'],
    source: 'marketplace',
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: '联网搜索网页和新闻，适合实时信息、资料查证和引用来源。',
    category: 'web',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
    package: '@modelcontextprotocol/server-brave-search',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['web.search'],
    requires: ['BRAVE_API_KEY'],
    source: 'marketplace',
  },
  {
    id: 'fetch',
    name: 'Fetch',
    description: '抓取网页内容并转换为模型友好的文本，适合网页资料读取。',
    category: 'web',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    package: 'mcp-server-fetch',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['web.fetch'],
    source: 'marketplace',
  },
  {
    id: 'git',
    name: 'Git',
    description: '读取仓库状态、提交历史和差异，适合代码仓库分析。',
    category: 'dev',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git', '--repository', '/path/to/repo'],
    package: 'mcp-server-git',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['repo.read'],
    requires: ['把 /path/to/repo 改成目标仓库路径'],
    source: 'marketplace',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '连接 GitHub 仓库、Issue 和 PR，适合研发协作和代码审查。',
    category: 'dev',
    transport: 'streamable_http',
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { Authorization: 'Bearer ${GITHUB_MCP_PAT}' },
    package: 'github/github-mcp-server',
    referenceUrl: 'https://github.com/github/github-mcp-server',
    capabilities: ['github.repos', 'github.issues', 'github.pull_requests'],
    requires: ['GITHUB_MCP_PAT 或 OAuth 授权'],
    source: 'marketplace',
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: '为复杂任务提供可追踪的多步推理过程，适合规划和拆解。',
    category: 'dev',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    package: '@modelcontextprotocol/server-sequential-thinking',
    referenceUrl: 'https://github.com/modelcontextprotocol/servers',
    capabilities: ['reasoning.plan'],
    source: 'marketplace',
  },
];

const BUILTIN_IDS = new Set(MARKETPLACE.map((item) => item.id).filter(Boolean) as string[]);

const CATEGORY_LABELS: Record<McpCategory, string> = {
  files: '文件',
  web: '联网',
  data: '数据',
  memory: '记忆',
  dev: '研发',
  custom: '自定义',
};

@Injectable()
export class McpService {
  constructor(
    @Optional()
    @InjectRepository(McpServer)
    private readonly mcpRepository?: Repository<McpServer>,
  ) {}

  async getMarketplace() {
    const registeredItems = await this.listRegisteredItems();
    const items = [...MARKETPLACE, ...registeredItems];

    return {
      items,
      total: items.length,
      builtInCount: MARKETPLACE.length,
      registeredCount: registeredItems.length,
      categories: this.getCategorySummaries(items),
      transports: ['stdio', 'streamable_http', 'sse'] satisfies McpTransport[],
      jsonExample: {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/workspace'],
          },
          remoteSearch: {
            transport: 'streamable_http',
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer ${TOKEN}' },
          },
        },
      },
    };
  }

  async listRegistered() {
    const items = await this.listRegisteredItems();
    return {
      items,
      total: items.length,
    };
  }

  async register(input: unknown, ownerId?: number | null) {
    if (!this.mcpRepository) {
      throw new BadRequestException('MCP 注册表未启用');
    }

    const servers = this.normalize(input).map((server) => ({
      ...server,
      id: this.makeRegistryId(server.id || server.name),
      category: this.normalizeCategory(server.category),
      source: 'registered' as McpSource,
    }));
    const saved: McpServer[] = [];

    for (const server of servers) {
      const payload = this.toEntityPayload(server, ownerId ?? null);
      const existing = await this.mcpRepository.findOne({ where: { registryId: payload.registryId } });
      const entity = existing
        ? { ...existing, ...payload }
        : this.mcpRepository.create(payload);
      saved.push(await this.mcpRepository.save(entity));
    }

    return {
      items: saved.map((entry) => this.fromEntity(entry)),
      total: saved.length,
    };
  }

  async removeRegistered(registryId: string) {
    if (!this.mcpRepository) {
      throw new BadRequestException('MCP 注册表未启用');
    }

    const result = await this.mcpRepository.delete({ registryId });
    return {
      deleted: Boolean(result.affected),
      id: registryId,
    };
  }

  normalize(input: unknown): McpServerConfig[] {
    const payload = this.unwrapInput(input);
    const candidates = this.collectCandidates(payload);
    const normalized = candidates.map(([name, config]) => this.normalizeOne(name, config));
    const seen = new Set<string>();

    return normalized.map((server) => {
      const base = this.slugify(server.name);
      let id = server.id || base;
      let index = 2;
      while (seen.has(id)) {
        id = `${base}-${index}`;
        index += 1;
      }
      seen.add(id);
      return { ...server, id };
    });
  }

  probe(input: unknown) {
    const servers = this.normalize(input);
    return {
      ok: true,
      executable: false,
      message: '配置格式有效。为安全起见，平台不会在探测阶段执行 stdio 命令；运行时执行前仍会按权限策略校验。',
      servers,
      warnings: servers.flatMap((server) => this.getWarnings(server)),
    };
  }

  private unwrapInput(input: unknown): unknown {
    if (typeof input === 'string') {
      return this.parseJson(input);
    }

    if (this.isPlainObject(input)) {
      const obj = input as Record<string, unknown>;
      if (typeof obj.json === 'string' && obj.json.trim()) {
        return this.parseJson(obj.json);
      }
      if (obj.config !== undefined) {
        return typeof obj.config === 'string' ? this.parseJson(obj.config) : obj.config;
      }
    }

    return input;
  }

  private collectCandidates(payload: unknown): Array<[string, Record<string, unknown>]> {
    if (Array.isArray(payload)) {
      return payload.map((item, index) => {
        if (!this.isPlainObject(item)) {
          throw new BadRequestException(`第 ${index + 1} 个 MCP 配置不是对象`);
        }
        const name = String((item as Record<string, unknown>).name || `mcp-${index + 1}`);
        return [name, item as Record<string, unknown>];
      });
    }

    if (!this.isPlainObject(payload)) {
      throw new BadRequestException('MCP 配置必须是 JSON 对象或数组');
    }

    const obj = payload as Record<string, unknown>;
    if (this.looksLikeServer(obj)) {
      return [[String(obj.name || 'mcp-server'), obj]];
    }

    const servers = obj.mcpServers || obj.servers;
    if (Array.isArray(servers)) {
      return this.collectCandidates(servers);
    }
    if (this.isPlainObject(servers)) {
      return Object.entries(servers as Record<string, unknown>).map(([name, value]) => {
        if (!this.isPlainObject(value)) {
          throw new BadRequestException(`MCP Server "${name}" 配置不是对象`);
        }
        return [name, value as Record<string, unknown>];
      });
    }

    return Object.entries(obj).map(([name, value]) => {
      if (!this.isPlainObject(value)) {
        throw new BadRequestException(`MCP Server "${name}" 配置不是对象`);
      }
      return [name, value as Record<string, unknown>];
    });
  }

  private normalizeOne(name: string, raw: Record<string, unknown>): McpServerConfig {
    const transport = this.normalizeTransport(raw.transport, raw.url);
    const server: McpServerConfig = {
      id: typeof raw.id === 'string' ? raw.id : undefined,
      name: String(raw.name || name).trim(),
      transport,
      description: typeof raw.description === 'string' ? raw.description : undefined,
      source: this.normalizeSource(raw.source),
      disabled: raw.disabled === true,
      package: typeof raw.package === 'string' ? raw.package : undefined,
      referenceUrl: typeof raw.referenceUrl === 'string' ? raw.referenceUrl : undefined,
      capabilities: this.asStringArray(raw.capabilities),
      category: this.normalizeCategory(raw.category),
      requires: this.asStringArray(raw.requires),
    };

    if (!server.name) {
      throw new BadRequestException('MCP Server 名称不能为空');
    }

    if (transport === 'stdio') {
      server.command = this.requiredString(raw.command, `MCP Server "${server.name}" 缺少 command`);
      server.args = this.asStringArray(raw.args);
      server.env = this.asStringRecord(raw.env);
    } else {
      server.url = this.requiredUrl(raw.url, `MCP Server "${server.name}" 缺少有效 URL`);
      server.headers = this.asStringRecord(raw.headers);
    }

    return server;
  }

  private normalizeTransport(value: unknown, url: unknown): McpTransport {
    const raw = typeof value === 'string' ? value.trim().toLowerCase().replace(/-/g, '_') : '';
    if (raw === 'streamable_http' || raw === 'http') return 'streamable_http';
    if (raw === 'sse') return 'sse';
    if (raw === 'stdio') return 'stdio';
    return typeof url === 'string' && url.trim() ? 'streamable_http' : 'stdio';
  }

  private parseJson(json: string): unknown {
    try {
      return JSON.parse(json);
    } catch {
      throw new BadRequestException('MCP JSON 解析失败，请检查逗号、引号和括号');
    }
  }

  private looksLikeServer(obj: Record<string, unknown>): boolean {
    return typeof obj.command === 'string' || typeof obj.url === 'string' || typeof obj.transport === 'string';
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private requiredString(value: unknown, message: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(message);
    }
    return value.trim();
  }

  private requiredUrl(value: unknown, message: string): string {
    const url = this.requiredString(value, message);
    if (!/^https?:\/\//i.test(url)) {
      throw new BadRequestException(message);
    }
    return url;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item !== undefined && item !== null).map((item) => String(item));
  }

  private asStringRecord(value: unknown): Record<string, string> | undefined {
    if (!this.isPlainObject(value)) return undefined;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key.trim())
        .map(([key, val]) => [key, val === undefined || val === null ? '' : String(val)]),
    );
  }

  private slugify(value: string): string {
    const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return slug || 'mcp-server';
  }

  private normalizeSource(value: unknown): McpSource {
    if (value === 'marketplace' || value === 'manual' || value === 'registered') return value;
    return 'json';
  }

  private normalizeCategory(value: unknown): McpCategory {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (raw === 'files' || raw === 'web' || raw === 'data' || raw === 'memory' || raw === 'dev' || raw === 'custom') {
      return raw;
    }
    return 'custom';
  }

  private makeRegistryId(value: string): string {
    const id = this.slugify(value);
    return BUILTIN_IDS.has(id) ? `custom-${id}` : id;
  }

  private async listRegisteredItems(): Promise<McpMarketplaceItem[]> {
    if (!this.mcpRepository) return [];

    const entries = await this.mcpRepository.find({
      order: { updatedAt: 'DESC' },
    });
    return entries
      .filter((entry) => entry.enabled !== false)
      .map((entry) => this.fromEntity(entry));
  }

  private toEntityPayload(server: McpServerConfig, ownerId: number | null): Partial<McpServer> {
    return {
      registryId: server.id || this.makeRegistryId(server.name),
      name: server.name,
      category: this.normalizeCategory(server.category),
      source: 'registered',
      transport: server.transport,
      description: server.description || null,
      command: server.command || null,
      args: server.args || [],
      env: server.env || null,
      url: server.url || null,
      headers: server.headers || null,
      package: server.package || null,
      referenceUrl: server.referenceUrl || null,
      capabilities: server.capabilities || [],
      requires: server.requires || [],
      enabled: server.disabled !== true,
      ownerId,
    };
  }

  private fromEntity(entry: McpServer): McpMarketplaceItem {
    const item: McpMarketplaceItem = {
      id: entry.registryId,
      name: entry.name,
      description: entry.description || undefined,
      category: this.normalizeCategory(entry.category),
      transport: entry.transport,
      command: entry.command || undefined,
      args: entry.args || [],
      env: entry.env || undefined,
      url: entry.url || undefined,
      headers: entry.headers || undefined,
      source: 'registered',
      package: entry.package || undefined,
      referenceUrl: entry.referenceUrl || undefined,
      capabilities: entry.capabilities || [],
      requires: entry.requires || [],
      disabled: entry.enabled === false,
      ownerId: entry.ownerId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
    return item;
  }

  private getCategorySummaries(items: McpMarketplaceItem[]) {
    const counts = new Map<McpCategory, number>();
    for (const item of items) {
      const category = this.normalizeCategory(item.category);
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([value, count]) => ({
      value,
      label: CATEGORY_LABELS[value],
      count,
    }));
  }

  private getWarnings(server: McpServerConfig): string[] {
    const warnings: string[] = [];
    if (server.transport === 'stdio') {
      warnings.push(`${server.name}: stdio 需要运行时所在机器安装 ${server.command}`);
    }
    if (server.env && Object.values(server.env).some((value) => /\$\{.+\}/.test(value))) {
      warnings.push(`${server.name}: env 中还有占位符，发布前需要替换为真实环境变量`);
    }
    if (server.args?.some((arg) => arg.includes('/path/to/'))) {
      warnings.push(`${server.name}: args 中还有示例路径，需要改成真实路径`);
    }
    return warnings;
  }
}
