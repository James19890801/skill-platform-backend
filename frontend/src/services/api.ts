import axios from 'axios';
import { useAuthStore } from '../stores/useAuthStore';
import type {
  ISkill,
  IOrganization,
  IJobModel,
  ISkillReview,
  IUser,
  ITenant,
  PaginatedResponse,
  SkillListParams,
  ReviewListParams,
  SearchParams,
  LoginRequest,
  LoginResponse,
} from '../types';

// Axios 实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
// Organizations API
// ============================================
export const orgsApi = {
  getTree: (): Promise<IOrganization[]> =>
    apiClient.get('/orgs/tree'),
  
  list: (): Promise<IOrganization[]> =>
    apiClient.get('/orgs'),
  
  getById: (id: number): Promise<IOrganization> =>
    apiClient.get(`/orgs/${id}`),
  
  create: (data: Partial<IOrganization>): Promise<IOrganization> =>
    apiClient.post('/orgs', data),
  
  update: (id: number, data: Partial<IOrganization>): Promise<IOrganization> =>
    apiClient.put(`/orgs/${id}`, data),
  
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/orgs/${id}`),
  
  getMembers: (id: number): Promise<IUser[]> =>
    apiClient.get(`/orgs/${id}/members`),
  
  getSkills: (id: number): Promise<ISkill[]> =>
    apiClient.get(`/orgs/${id}/skills`),
};

// ============================================
// Job Models API
// ============================================
export const modelsApi = {
  list: (orgId?: number): Promise<IJobModel[]> =>
    apiClient.get('/models', { params: { orgId } }),
  
  getById: (id: number): Promise<IJobModel> =>
    apiClient.get(`/models/${id}`),
  
  create: (data: Partial<IJobModel>): Promise<IJobModel> =>
    apiClient.post('/models', data),
  
  update: (id: number, data: Partial<IJobModel>): Promise<IJobModel> =>
    apiClient.put(`/models/${id}`, data),
  
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/models/${id}`),
  
  bindSkill: (modelId: number, skillId: number, data: unknown): Promise<unknown> =>
    apiClient.post(`/models/${modelId}/skills/${skillId}`, data),
  
  unbindSkill: (modelId: number, skillId: number): Promise<void> =>
    apiClient.delete(`/models/${modelId}/skills/${skillId}`),
  
  getSkills: (id: number): Promise<unknown[]> =>
    apiClient.get(`/models/${id}/skills`),
};

// ============================================
// Reviews API
// ============================================
export const reviewsApi = {
  list: (params?: ReviewListParams): Promise<PaginatedResponse<ISkillReview>> =>
    apiClient.get('/reviews', { params }),
  
  getById: (id: number): Promise<ISkillReview> =>
    apiClient.get(`/reviews/${id}`),
  
  approve: (id: number, comment?: string): Promise<ISkillReview> =>
    apiClient.post(`/reviews/${id}/approve`, { comment }),
  
  reject: (id: number, comment: string): Promise<ISkillReview> =>
    apiClient.post(`/reviews/${id}/reject`, { comment }),
  
  getPending: (): Promise<ISkillReview[]> =>
    apiClient.get('/reviews/pending'),
  
  getMyReviews: (): Promise<ISkillReview[]> =>
    apiClient.get('/reviews/my'),
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
// Tenants API (租户管理)
// ============================================
export const tenantsApi = {
  list: (): Promise<ITenant[]> =>
    apiClient.get('/tenants'),
  
  getById: (id: number): Promise<ITenant> =>
    apiClient.get(`/tenants/${id}`),
  
  create: (data: Partial<ITenant>): Promise<ITenant> =>
    apiClient.post('/tenants', data),
  
  update: (id: number, data: Partial<ITenant>): Promise<ITenant> =>
    apiClient.put(`/tenants/${id}`, data),
  
  delete: (id: number): Promise<void> =>
    apiClient.delete(`/tenants/${id}`),
  
  // 钉钉集成
  updateDingtalkConfig: (id: number, config: { appKey: string; appSecret: string; corpId: string }): Promise<ITenant> =>
    apiClient.put(`/tenants/${id}`, { 
      dingtalkAppKey: config.appKey, 
      dingtalkAppSecret: config.appSecret, 
      dingtalkCorpId: config.corpId 
    }),
  
  // 同步组织架构
  syncOrgFromDingtalk: (id: number): Promise<void> =>
    apiClient.post(`/tenants/${id}/sync-dingtalk`),
};

// ============================================
// Architecture API (架构树)
// ============================================
export interface IArchTreeResponse {
  id: number;
  name: string;
  currentVersion: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IArchNodeResponse {
  id: number;
  treeId: number;
  name: string;
  level: number;
  parentId: number | null;
  sortOrder: number;
  description?: string;
  skillCoverage: number;
  totalSkills: number;
  coveredSkills: number;
  createdAt: string;
  updatedAt: string;
  children?: IArchNodeResponse[];
  files?: IArchFileResponse[];
}

export interface IArchFileResponse {
  id: number;
  nodeId: number;
  name: string;
  type: string;
  content?: string;
  size?: number;
  uploadedAt: string;
}

export const archApi = {
  // 树管理
  getTrees: (): Promise<IArchTreeResponse[]> =>
    apiClient.get('/architecture/trees'),
  
  getActiveTree: (): Promise<IArchTreeResponse | null> =>
    apiClient.get('/architecture/trees/active'),
  
  createTree: (data: { name: string; currentVersion?: string }): Promise<IArchTreeResponse> =>
    apiClient.post('/architecture/trees', data),
  
  updateTree: (id: number, data: Partial<{ name: string; currentVersion: string; isActive: boolean }>): Promise<IArchTreeResponse> =>
    apiClient.put(`/architecture/trees/${id}`, data),
  
  deleteTree: (id: number): Promise<void> =>
    apiClient.delete(`/architecture/trees/${id}`),
  
  activateTree: (id: number): Promise<IArchTreeResponse> =>
    apiClient.put(`/architecture/trees/${id}/activate`),
  
  saveVersion: (id: number, data: { version: string; label?: string }): Promise<IArchTreeResponse> =>
    apiClient.post(`/architecture/trees/${id}/version`, data),
  
  // 节点管理
  getNodeTree: (treeId: number): Promise<IArchNodeResponse[]> =>
    apiClient.get('/architecture/nodes/tree', { params: { treeId } }),
  
  getLeafNodes: (treeId: number): Promise<IArchNodeResponse[]> =>
    apiClient.get('/architecture/nodes/leaves', { params: { treeId } }),
  
  createNode: (data: { treeId: number; name: string; level: number; parentId?: number | null; description?: string; sortOrder?: number }): Promise<IArchNodeResponse> =>
    apiClient.post('/architecture/nodes', data),
  
  updateNode: (id: number, data: Partial<{ name: string; description: string; sortOrder: number; skillCoverage: number; totalSkills: number; coveredSkills: number }>): Promise<IArchNodeResponse> =>
    apiClient.put(`/architecture/nodes/${id}`, data),
  
  deleteNode: (id: number): Promise<void> =>
    apiClient.delete(`/architecture/nodes/${id}`),
  
  // 文件管理
  createFile: (data: { nodeId: number; name: string; type: string; content?: string; size?: number }): Promise<IArchFileResponse> =>
    apiClient.post('/architecture/files', data),
  
  deleteFile: (id: number): Promise<void> =>
    apiClient.delete(`/architecture/files/${id}`),
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
