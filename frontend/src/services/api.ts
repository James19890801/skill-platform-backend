import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import type {
  ISkill,
  IUser,
  PaginatedResponse,
  SkillListParams,
  SearchParams,
  LoginRequest,
  LoginResponse,
  ISkillRuntimeArtifact,
  ISkillRuntimeEvent,
} from '../types';

// Axios 实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://skill-platform-backend-production.up.railway.app/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动附加 Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：解包后端响应
apiClient.interceptors.response.use(
  (response) => {
    // 后端使用 TransformInterceptor 包装响应为 { success, data, timestamp }
    // 需要解包返回实际数据
    const wrappedData = response.data;
    if (wrappedData && typeof wrappedData === 'object' && 'data' in wrappedData) {
      return wrappedData.data;
    }
    return wrappedData;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// Auth API
// ============================================
export const authApi = {
  login: (data: LoginRequest): Promise<LoginResponse> =>
    apiClient.post('/auth/login', data),
  
  logout: (): Promise<void> =>
    apiClient.post('/auth/logout'),
  
  getCurrentUser: (): Promise<IUser> =>
    apiClient.get('/auth/profile'),
};

// ============================================
// Skills API
// ============================================
export const skillsApi = {
  list: (params?: SkillListParams): Promise<PaginatedResponse<ISkill>> =>
    apiClient.get('/skills', { params }),
  
  getById: (id: number): Promise<ISkill> =>
    apiClient.get(`/skills/${id}`),
  
  create: (data: Partial<ISkill>): Promise<ISkill> =>
    apiClient.post('/skills', data),

  importPackage: (file: File, data?: Partial<ISkill>): Promise<ISkill> => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(data || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    return apiClient.post('/skills/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  packageDownloadUrl: (id: number): string =>
    `${String(apiClient.defaults.baseURL || '').replace(/\/$/, '')}/skills/${id}/package.zip`,
  
  update: (id: number, data: Partial<ISkill>): Promise<ISkill> =>
    apiClient.put(`/skills/${id}`, data),
  
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/skills/${id}`),
  
  submitForReview: (id: number): Promise<ISkill> =>
    apiClient.post(`/skills/${id}/submit`),
  
  publish: (id: number): Promise<ISkill> =>
    apiClient.post(`/skills/${id}/publish`),
  
  archive: (id: number): Promise<ISkill> =>
    apiClient.post(`/skills/${id}/archive`),
  
  getVersions: (id: number): Promise<ISkill['versions']> =>
    apiClient.get(`/skills/${id}/versions`),
  
  createVersion: (id: number, data: unknown): Promise<unknown> =>
    apiClient.post(`/skills/${id}/versions`, data),
};

// ============================================
// Skill Runtime API
// ============================================
export interface SkillRuntimeQueueResponse {
  executionId: number;
  status: string;
  threadId: string;
  queue: {
    queued: number;
    running: number;
    concurrency: number;
  };
}

export interface SkillExecutionDetail {
  id: number;
  skillId: number;
  threadId?: string;
  workspaceId?: string;
  status: string;
  input?: string;
  output?: string;
  artifacts?: string;
  logs?: string;
  totalRounds: number;
  totalDurationMs: number;
  runtimeEvents: ISkillRuntimeEvent[];
  runtimeArtifacts: ISkillRuntimeArtifact[];
}

export const skillRuntimeApi = {
  queue: (skillId: number, data: { input: string; threadId?: string }): Promise<SkillRuntimeQueueResponse> =>
    apiClient.post(`/ai/execute-skill/${skillId}/queue`, data),

  getQueueStatus: (): Promise<SkillRuntimeQueueResponse['queue']> =>
    apiClient.get('/ai/execute-skill/queue/status'),

  getEvents: (executionId: number, after?: number): Promise<ISkillRuntimeEvent[]> =>
    apiClient.get(`/ai/execute-skill/execution/${executionId}/events`, { params: after ? { after } : undefined }),

  getExecutionDetail: (executionId: number): Promise<SkillExecutionDetail> =>
    apiClient.get(`/ai/execute-skill/execution/${executionId}`),
};

// ============================================
// Search API
// ============================================
export const searchApi = {
  search: (params: SearchParams): Promise<PaginatedResponse<ISkill>> =>
    apiClient.get('/search', { params }),
  
  suggest: (keyword: string): Promise<string[]> =>
    apiClient.get('/search/suggest', { params: { keyword } }),
  
  getPopular: (): Promise<ISkill[]> =>
    apiClient.get('/search/popular'),
  
  getRecent: (): Promise<ISkill[]> =>
    apiClient.get('/search/recent'),
};

// ============================================
// Users API
// ============================================
export const usersApi = {
  list: (): Promise<IUser[]> =>
    apiClient.get('/users'),
  
  getById: (id: number): Promise<IUser> =>
    apiClient.get(`/users/${id}`),
};



// ============================================
// Models API
// ============================================
export const modelsApi = {
  list: (): Promise<any[]> =>
    apiClient.get('/models'),
};

export interface LlmProvider {
  id: number;
  name: string;
  provider: string;
  baseUrl: string;
  enabled: boolean;
  models?: LlmModel[];
}

export interface LlmModel {
  id?: number;
  code: string;
  model: string;
  label: string;
  provider?: string;
  providerName?: string;
  capability: string;
  enabled: boolean;
}

export const llmApi = {
  listProviders: (): Promise<LlmProvider[]> =>
    apiClient.get('/llm/providers'),

  createProvider: (data: { name: string; provider: string; baseUrl?: string; apiKey: string }): Promise<LlmProvider> =>
    apiClient.post('/llm/providers', data),

  scanProvider: (id: number): Promise<{ providerId: number; models: LlmModel[] }> =>
    apiClient.post(`/llm/providers/${id}/scan`),

  listModels: (): Promise<LlmModel[]> =>
    apiClient.get('/llm/models'),
};

// ============================================
// Dashboard API
// ============================================
export const dashboardApi = {
  getStats: (): Promise<{
    totalSkills: number;
    publishedSkills: number;
    draftSkills: number;
    archivedSkills: number;
    totalOrgs: number;
    totalModels: number;
    totalUsers: number;
    pendingReviews: number;
    domainStats: Array<{ domain: string; count: number; published: number }>;
    recentSkills: ISkill[];
    coverageRate: number;
  }> => apiClient.get('/dashboard/stats'),
};

// ============================================
// AI API (通义千问)
// ============================================
export interface IAiPlanSkillRequest {
  nodeName: string;
  nodeDescription?: string;
  customPrompt?: string;
}

export interface IAiPlannedSkill {
  name: string;
  description: string;
  scenario: string;
  priority: 'high' | 'medium' | 'low';
  type?: 'professional' | 'general' | 'management';
  // 执行配置推断字段
  executionType?: 'api' | 'webhook' | 'rpa' | 'agent' | 'manual';
  endpoint?: string;
  httpMethod?: string;
  requestTemplate?: string;
  responseMapping?: string;
  agentPrompt?: string;
  toolDefinition?: string;
  systemHint?: string;
}

export interface IAiPlanSkillResponse {
  success: boolean;
  data: IAiPlannedSkill[];
  message?: string;
}

export const aiApi = {
  planSkills: (data: IAiPlanSkillRequest): Promise<IAiPlanSkillResponse> =>
    apiClient.post('/ai/plan-skills', data),
};

// ============================================
// Knowledge Bases API
// ============================================
export interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  source: 'bailian' | 'local' | 'web' | 'file';
  status: 'connected' | 'syncing' | 'error';
  documentCount: number;
  chunkCount?: number;
  indexedDocuments?: KnowledgeDocument[];
  user?: IUser;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeChunk {
  id: number;
  knowledgeBaseId: number;
  documentId: number;
  documentName?: string;
  knowledgeBaseName?: string;
  chunkIndex: number;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface KnowledgeDocument {
  id: number;
  knowledgeBaseId: number;
  name: string;
  mimeType?: string;
  size: number;
  status: 'processing' | 'indexed' | 'error';
  textPreview?: string;
  chunkCount: number;
  error?: string;
  createdAt?: string;
}

export interface KnowledgeSearchResult {
  id: number;
  documentId: number;
  documentName?: string;
  knowledgeBaseName?: string;
  chunkIndex?: number;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSourceReference {
  id: string;
  knowledgeBaseId: number;
  knowledgeBaseName: string;
  documentId: number;
  documentName: string;
  chunkId: number;
  chunkIndex: number;
  score: number;
  sectionTitle?: string;
  preview: string;
  content?: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string;
  source?: string;
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  source?: string;
  status?: string;
}

export const knowledgeApi = {
  list: (): Promise<KnowledgeBase[]> =>
    apiClient.get('/knowledge-bases'),

  getById: (id: number): Promise<KnowledgeBase> =>
    apiClient.get(`/knowledge-bases/${id}`),

  create: (data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> =>
    apiClient.post('/knowledge-bases', data),

  uploadDocument: (id: number, file: File, options?: { chunkSize?: number; chunkOverlap?: number }): Promise<KnowledgeDocument> => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    if (options?.chunkSize) formData.append('chunkSize', String(options.chunkSize));
    if (options?.chunkOverlap) formData.append('chunkOverlap', String(options.chunkOverlap));
    return apiClient.post(`/knowledge-bases/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },

  ingestText: (id: number, data: { name?: string; content: string; chunkSize?: number; chunkOverlap?: number }): Promise<KnowledgeDocument> =>
    apiClient.post(`/knowledge-bases/${id}/text`, data),

  listDocuments: (id: number): Promise<KnowledgeDocument[]> =>
    apiClient.get(`/knowledge-bases/${id}/documents`),

  listChunks: (id: number, params?: { documentId?: number; limit?: number; offset?: number }): Promise<{ items: KnowledgeChunk[]; total: number }> =>
    apiClient.get(`/knowledge-bases/${id}/chunks`, { params }),

  getChunk: (id: number, chunkId: number): Promise<KnowledgeChunk> =>
    apiClient.get(`/knowledge-bases/${id}/chunks/${chunkId}`),

  search: (id: number, data: { query: string; topK?: number }): Promise<{ query: string; topK: number; results: KnowledgeSearchResult[]; context: string; sources?: KnowledgeSourceReference[] }> =>
    apiClient.post(`/knowledge-bases/${id}/search`, data),

  update: (id: number, data: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> =>
    apiClient.put(`/knowledge-bases/${id}`, data),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`/knowledge-bases/${id}`),

  sync: (data: { apiKey: string; kbId: string }): Promise<any> =>
    apiClient.post('/knowledge-bases/sync', data),
};

// ============================================
// Agents API
// ============================================
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
  category?: string;
  requires?: string[];
}

export interface McpMarketplaceResponse {
  items: McpServerConfig[];
  transports: McpTransport[];
  jsonExample: Record<string, unknown>;
}

export const mcpApi = {
  marketplace: (): Promise<McpMarketplaceResponse> =>
    apiClient.get('/mcp/marketplace'),

  normalize: (data: { json?: string; config?: unknown }): Promise<{ servers: McpServerConfig[] }> =>
    apiClient.post('/mcp/normalize', data),

  probe: (data: { json?: string; config?: unknown }): Promise<{ ok: boolean; servers: McpServerConfig[]; warnings: string[]; message: string }> =>
    apiClient.post('/mcp/probe', data),
};

export interface AgentDTO {
  id: number;
  name: string;
  description?: string;
  avatar?: string;
  model: string;
  systemPrompt?: string;
  skills: string[];
  knowledgeBases: string[];
  mcpServers: McpServerConfig[];
  memoryEnabled: boolean;
  temperature: number;
  maxTokens?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const agentsApi = {
  list: (): Promise<{ items: AgentDTO[]; total: number }> =>
    apiClient.get('/agents'),

  getById: (id: number): Promise<AgentDTO> =>
    apiClient.get(`/agents/${id}`),

  create: (data: Record<string, unknown>): Promise<AgentDTO> =>
    apiClient.post('/agents', data),

  update: (id: number, data: Record<string, unknown>): Promise<AgentDTO> =>
    apiClient.put(`/agents/${id}`, data),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`/agents/${id}`),
};

// ============================================
// Memory API
// ============================================
export interface MemoryDTO {
  id: number;
  agentId: number;
  key: string;
  value: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export const memoriesApi = {
  list: (agentId?: number): Promise<MemoryDTO[]> =>
    apiClient.get('/memories', { params: agentId ? { agentId } : {} }),

  create: (data: { agentId: number; key: string; value: string; category?: string }): Promise<MemoryDTO> =>
    apiClient.post('/memories', data),

  update: (id: number, data: { key?: string; value?: string; category?: string }): Promise<MemoryDTO> =>
    apiClient.put(`/memories/${id}`, data),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`/memories/${id}`),
};

// ============================================
// Architecture API
// ============================================
export interface IArchFileResponse {
  id: number;
  name: string;
  type: string;
  content?: string;
  size?: number;
  uploadedAt: string;
}

export interface IArchNodeResponse {
  id: number;
  name: string;
  level: number;
  parentId: number | null;
  description?: string;
  sortOrder: number;
  skillCoverage: number;
  totalSkills: number;
  coveredSkills: number;
  files?: IArchFileResponse[];
  children: IArchNodeResponse[];
}

export interface IArchTreeResponse {
  id: number;
  name: string;
  currentVersion: string;
  versionLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export default apiClient;
