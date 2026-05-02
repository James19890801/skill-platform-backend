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
  
  getByOrg: (orgId: number): Promise<IUser[]> =>
    apiClient.get('/users', { params: { orgId } }),
};

// ============================================
// Orgs API
// ============================================
export const orgsApi = {
  getTree: (): Promise<any[]> =>
    apiClient.get('/orgs/tree'),

  list: (): Promise<any[]> =>
    apiClient.get('/orgs'),
};

// ============================================
// Models API
// ============================================
export const modelsApi = {
  list: (): Promise<any[]> =>
    apiClient.get('/models'),
};

// ============================================
// Dashboard API
// ============================================
export const dashboardApi = {
  getStats: (): Promise<{
    totalSkills: number;
    publishedSkills: number;
    pendingReviews: number;
    totalOrgs: number;
    totalModels: number;
    recentSkills: ISkill[];
    skillsByDomain: Record<string, number>;
    skillsByScope: Record<string, number>;
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
  user?: IUser;
  createdAt?: string;
  updatedAt?: string;
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

  update: (id: number, data: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> =>
    apiClient.put(`/knowledge-bases/${id}`, data),

  delete: (id: number): Promise<void> =>
    apiClient.delete(`/knowledge-bases/${id}`),
};

// ============================================
// Agents API
// ============================================
export interface AgentDTO {
  id: number;
  name: string;
  description?: string;
  model: string;
  systemPrompt?: string;
  skills: string[];
  knowledgeBases: string[];
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

export default apiClient;
