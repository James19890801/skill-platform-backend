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

// 响应拦截器：处理 401 自动跳转登录，解包后端响应
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
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
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
// Process API (流程)
// ============================================
export interface IProcessResponse {
  id: number;
  name: string;
  description?: string;
  domain: string;
  status: string;
  archNodeId?: number;
  nodesJson?: string;
  coverage: number;
  sopCount: number;
  skillCount: number;
  createdAt: string;
  updatedAt: string;
  documents?: IProcessDocumentResponse[];
}

export interface IProcessDocumentResponse {
  id: number;
  processId: number;
  name: string;
  type: string;
  content?: string;
  uploadedAt: string;
}

export const processApi = {
  list: (): Promise<IProcessResponse[]> =>
    apiClient.get('/processes'),
  
  getById: (id: number): Promise<IProcessResponse> =>
    apiClient.get(`/processes/${id}`),
  
  create: (data: { name: string; description?: string; domain?: string; status?: string; archNodeId?: number; nodesJson?: string }): Promise<IProcessResponse> =>
    apiClient.post('/processes', data),
  
  update: (id: number, data: Partial<{ name: string; description: string; domain: string; status: string; archNodeId: number; nodesJson: string; coverage: number; sopCount: number; skillCount: number }>): Promise<IProcessResponse> =>
    apiClient.put(`/processes/${id}`, data),
  
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/processes/${id}`),
  
  getDocuments: (processId: number): Promise<IProcessDocumentResponse[]> =>
    apiClient.get(`/processes/${processId}/documents`),
  
  createDocument: (processId: number, data: { name: string; type: string; content?: string }): Promise<IProcessDocumentResponse> =>
    apiClient.post(`/processes/${processId}/documents`, data),
};

// ============================================
// AI API (通义千问)
// ============================================
export interface IProcessFileInfo {
  name: string;
  type?: string;
  content?: string;
}

export interface IAiPlanSkillRequest {
  nodeName: string;
  nodeDescription?: string;
  processFiles?: (string | IProcessFileInfo)[];  // 支持字符串或对象
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

export default apiClient;
